-- ============================================================================
-- ALFAAZ OPEN MIC — SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Helper Function: Check if current user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  );
$$;

-- 2. EVENTS POLICIES
-- Anyone can view active events
CREATE POLICY "Public events are viewable by everyone"
  ON public.events FOR SELECT
  USING (active = true);

-- Admins have full access to events
CREATE POLICY "Admins have full access to events"
  ON public.events FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. TICKET TYPES POLICIES
-- Anyone can view ticket types
CREATE POLICY "Ticket types are viewable by everyone"
  ON public.ticket_types FOR SELECT
  USING (true);

-- Admins have full access to ticket types
CREATE POLICY "Admins have full access to ticket types"
  ON public.ticket_types FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. PROFILES POLICIES
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can view and manage all profiles
CREATE POLICY "Admins have full access to profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. BOOKINGS POLICIES
-- Users can view their own bookings
CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins have full access to bookings
CREATE POLICY "Admins have full access to bookings"
  ON public.bookings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. PAYMENTS POLICIES
-- Users can view payments for their own bookings
CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE public.bookings.id = public.payments.booking_id
        AND public.bookings.user_id = auth.uid()
    )
  );

-- Admins have full access to payments
CREATE POLICY "Admins have full access to payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7. TICKETS POLICIES
-- Users can view tickets for their own bookings
CREATE POLICY "Users can view own tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE public.bookings.id = public.tickets.booking_id
        AND public.bookings.user_id = auth.uid()
    )
  );

-- Admins have full access to tickets
CREATE POLICY "Admins have full access to tickets"
  ON public.tickets FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8. CHECK-INS POLICIES
-- Admins have full access to check-ins
CREATE POLICY "Admins have full access to check_ins"
  ON public.check_ins FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 9. ADMIN AUDIT LOGS POLICIES
-- Admins have full access to audit logs
CREATE POLICY "Admins have full access to audit logs"
  ON public.admin_audit_logs FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
