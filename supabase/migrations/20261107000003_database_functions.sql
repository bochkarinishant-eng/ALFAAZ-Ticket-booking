-- ============================================================================
-- ALFAAZ OPEN MIC — SUPABASE DATABASE FUNCTIONS & TRIGGERS
-- ============================================================================

-- 1. Trigger to automatically create a profile when a user signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'CUSTOMER')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Clean Expired Reservations Function
CREATE OR REPLACE FUNCTION public.clean_expired_reservations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Update bookings that were pending and their 15-minute reservation timer lapsed
  WITH expired_rows AS (
    UPDATE public.bookings
    SET status = 'EXPIRED', updated_at = now()
    WHERE status = 'PENDING' AND reserved_until < now()
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM expired_rows;

  -- Also update payments associated with expired bookings
  UPDATE public.payments
  SET status = 'EXPIRED', updated_at = now()
  WHERE status = 'PENDING'
    AND booking_id IN (SELECT id FROM public.bookings WHERE status = 'EXPIRED');

  RETURN v_count;
END;
$$;

-- 3. Atomic QR Ticket Door Check-in
CREATE OR REPLACE FUNCTION public.atomic_check_in(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_clean_token TEXT;
BEGIN
  v_clean_token := trim(p_token);
  IF v_clean_token IS NULL OR v_clean_token = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'INVALID TICKET',
      'message', 'Empty QR token scanned'
    );
  END IF;

  -- Select ticket with row-level lock to prevent concurrent double-entry
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE qr_token = v_clean_token
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.check_ins (ticket_id, token_scanned, attendee_name, result)
    VALUES (NULL, v_clean_token, 'Unknown', 'INVALID');

    RETURN jsonb_build_object(
      'success', false,
      'status', 'INVALID TICKET',
      'message', 'This QR code does not match any ticket in Alfaaz records.'
    );
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = v_ticket.booking_id;

  -- Check if ticket or booking is cancelled
  IF v_ticket.status = 'CANCELLED' OR v_booking.status = 'CANCELLED' THEN
    INSERT INTO public.check_ins (ticket_id, token_scanned, attendee_name, result)
    VALUES (v_ticket.id, v_clean_token, v_booking.full_name, 'CANCELLED');

    RETURN jsonb_build_object(
      'success', false,
      'status', 'TICKET CANCELLED',
      'attendeeName', v_booking.full_name,
      'ticketNumber', v_ticket.ticket_number,
      'ticketType', v_booking.ticket_type,
      'performerCategory', v_booking.performer_category,
      'message', 'This ticket has been cancelled.'
    );
  END IF;

  -- Check if booking is confirmed
  IF v_booking.status != 'CONFIRMED' THEN
    INSERT INTO public.check_ins (ticket_id, token_scanned, attendee_name, result)
    VALUES (v_ticket.id, v_clean_token, v_booking.full_name, 'PAYMENT_NOT_VERIFIED');

    RETURN jsonb_build_object(
      'success', false,
      'status', 'PAYMENT NOT VERIFIED',
      'attendeeName', v_booking.full_name,
      'ticketNumber', v_ticket.ticket_number,
      'ticketType', v_booking.ticket_type,
      'performerCategory', v_booking.performer_category,
      'message', 'Payment for this ticket has not been verified.'
    );
  END IF;

  -- Check if already used
  IF v_ticket.attended = true OR v_ticket.status = 'USED' OR v_ticket.checked_in_at IS NOT NULL THEN
    INSERT INTO public.check_ins (ticket_id, token_scanned, attendee_name, result)
    VALUES (v_ticket.id, v_clean_token, v_booking.full_name, 'ALREADY_USED');

    RETURN jsonb_build_object(
      'success', false,
      'status', 'ALREADY CHECKED IN',
      'attendeeName', v_booking.full_name,
      'ticketNumber', v_ticket.ticket_number,
      'ticketType', v_booking.ticket_type,
      'performerCategory', v_booking.performer_category,
      'checkedInAt', v_ticket.checked_in_at,
      'message', 'This ticket has already been used for entry!'
    );
  END IF;

  -- Approve check-in
  UPDATE public.tickets
  SET attended = true,
      status = 'USED',
      checked_in_at = now()
  WHERE id = v_ticket.id;

  INSERT INTO public.check_ins (ticket_id, token_scanned, attendee_name, result)
  VALUES (v_ticket.id, v_clean_token, v_booking.full_name, 'APPROVED');

  RETURN jsonb_build_object(
    'success', true,
    'status', 'ENTRY APPROVED',
    'attendeeName', v_booking.full_name,
    'ticketNumber', v_ticket.ticket_number,
    'ticketType', v_booking.ticket_type,
    'performerCategory', v_booking.performer_category,
    'checkedInAt', now(),
    'message', 'Welcome to Alfaaz Open Mic! Entry Approved.'
  );
END;
$$;

-- 4. Get Event Summary with Live Availability
CREATE OR REPLACE FUNCTION public.get_active_event_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_confirmed BIGINT;
  v_reserved BIGINT;
  v_available BIGINT;
BEGIN
  PERFORM public.clean_expired_reservations();

  SELECT * INTO v_event
  FROM public.events
  WHERE active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No active event found');
  END IF;

  SELECT count(*) INTO v_confirmed
  FROM public.bookings
  WHERE event_id = v_event.id AND status = 'CONFIRMED';

  SELECT count(*) INTO v_reserved
  FROM public.bookings
  WHERE event_id = v_event.id
    AND status IN ('PENDING', 'SUBMITTED')
    AND reserved_until > now();

  v_available := GREATEST(0, v_event.max_capacity - (v_confirmed + v_reserved));

  RETURN jsonb_build_object(
    'id', v_event.id,
    'title', v_event.title,
    'organizer', v_event.organizer,
    'eventDateTime', v_event.event_date_time,
    'venue', v_event.venue,
    'maxCapacity', v_event.max_capacity,
    'confirmedSeats', v_confirmed,
    'reservedSeats', v_reserved,
    'availableSeats', v_available,
    'audiencePrice', v_event.audience_price,
    'performerPrice', v_event.performer_price,
    'contactPhone', v_event.contact_phone,
    'upiId', v_event.upi_id,
    'active', v_event.active
  );
END;
$$;
