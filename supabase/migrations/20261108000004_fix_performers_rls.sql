-- ============================================================================
-- ALFAAZ OPEN MIC — FIX PERFORMERS RLS & AUTO-ADMIN PROVISIONING
-- ============================================================================

-- 1. Ensure all authenticated users in auth.users have an ADMIN profile in public.profiles
INSERT INTO public.profiles (id, email, role)
SELECT id, email, 'ADMIN'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'ADMIN';

-- 2. Trigger to automatically provision new auth sign-ins with ADMIN profile
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'ADMIN')
  ON CONFLICT (id) DO UPDATE SET role = 'ADMIN';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_admin_user();

-- 3. Update Performers RLS Policy so ANY authenticated admin can insert/update/delete performers
ALTER TABLE public.performers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active performers" ON public.performers;
CREATE POLICY "Public can view active performers"
  ON public.performers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins have full access to performers" ON public.performers;
CREATE POLICY "Admins have full access to performers"
  ON public.performers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Also grant service_role and authenticated full permissions on performers
GRANT ALL ON public.performers TO authenticated;
GRANT ALL ON public.performers TO service_role;
