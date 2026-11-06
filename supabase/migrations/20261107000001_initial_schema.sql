-- ============================================================================
-- ALFAAZ OPEN MIC — SUPABASE POSTGRESQL INITIAL SCHEMA
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  organizer TEXT NOT NULL DEFAULT 'Alfaaz',
  event_date_time TIMESTAMPTZ NOT NULL,
  venue TEXT NOT NULL,
  max_capacity INT NOT NULL DEFAULT 40,
  audience_price NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
  performer_price NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
  contact_phone TEXT NOT NULL DEFAULT '8624890246',
  upi_id TEXT NOT NULL DEFAULT '8624890246@ibl',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TICKET TYPES TABLE
CREATE TABLE IF NOT EXISTS public.ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'Audience' or 'Performer'
  price NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
  capacity INT NOT NULL DEFAULT 40,
  available_quantity INT NOT NULL DEFAULT 40,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. USER PROFILES TABLE (Linked with Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('ADMIN', 'CUSTOMER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT NOT NULL UNIQUE,
  access_key TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_type_id UUID REFERENCES public.ticket_types(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT DEFAULT '',
  ticket_type TEXT NOT NULL DEFAULT 'Audience',
  performer_category TEXT,
  performance_description TEXT,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  amount NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUBMITTED', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REJECTED')),
  reserved_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
  currency TEXT NOT NULL DEFAULT 'INR',
  payment_method TEXT NOT NULL DEFAULT 'UPI',
  utr_number TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUBMITTED', 'VERIFIED', 'FAILED', 'REJECTED', 'REFUNDED', 'EXPIRED')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  qr_token TEXT NOT NULL UNIQUE,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  ticket_type TEXT NOT NULL DEFAULT 'Audience',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'USED', 'CANCELLED')),
  attended BOOLEAN NOT NULL DEFAULT false,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. CHECK-INS TABLE (Door Scan Audit)
CREATE TABLE IF NOT EXISTS public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  token_scanned TEXT NOT NULL,
  attendee_name TEXT,
  result TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ADMIN AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_mobile ON public.bookings(mobile);
CREATE INDEX IF NOT EXISTS idx_bookings_ref ON public.bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_access_key ON public.bookings(access_key);
CREATE INDEX IF NOT EXISTS idx_bookings_event ON public.bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_utr ON public.payments(utr_number);
CREATE INDEX IF NOT EXISTS idx_tickets_token ON public.tickets(qr_token);
CREATE INDEX IF NOT EXISTS idx_tickets_number ON public.tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON public.tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_attended ON public.tickets(attended);
CREATE INDEX IF NOT EXISTS idx_checkins_scanned_at ON public.check_ins(scanned_at DESC);

-- ============================================================================
-- SEED INITIAL ACTIVE EVENT & TICKET TYPES
-- ============================================================================
DO $$
DECLARE
  v_event_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE active = true) THEN
    INSERT INTO public.events (
      id, title, organizer, event_date_time, venue,
      max_capacity, audience_price, performer_price, contact_phone, upi_id, active
    ) VALUES (
      'e1fa0000-0000-0000-0000-000000000001'::uuid,
      'Alfaaz Open Mic',
      'Alfaaz',
      '2026-11-09 17:00:00+05:30',
      'Beyond Temptation, Ashegaon Road, Basmat',
      40,
      100.00,
      100.00,
      '8624890246',
      '8624890246@ibl',
      true
    ) RETURNING id INTO v_event_id;

    -- Seed ticket types for this event
    INSERT INTO public.ticket_types (event_id, name, price, capacity, available_quantity)
    VALUES
      (v_event_id, 'Audience', 100.00, 40, 40),
      (v_event_id, 'Performer', 100.00, 40, 40);
  END IF;
END $$;
