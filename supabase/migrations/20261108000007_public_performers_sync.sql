-- ============================================================================
-- ALFAAZ OPEN MIC — MULTI-DEVICE PUBLIC PERFORMERS SYNC & RPC
-- ============================================================================

-- 1. Ensure any orphan or mismatched performers are linked to the active event
UPDATE public.performers
SET event_id = (SELECT id FROM public.events WHERE active = true ORDER BY created_at ASC LIMIT 1)
WHERE event_id IS NULL OR event_id NOT IN (SELECT id FROM public.events);

-- 2. Allow anonymous public users to select performers (for mobile audience voting)
GRANT SELECT ON public.performers TO anon, authenticated;
GRANT ALL ON public.performers TO service_role;

-- 3. Ensure SELECT policy on performers table allows public viewing
DROP POLICY IF EXISTS "Public can view active performers" ON public.performers;
CREATE POLICY "Public can view active performers"
  ON public.performers FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 4. Create Security Definer RPC function for 100% reliable performer syncing across all devices
CREATE OR REPLACE FUNCTION public.get_public_performers(p_event_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eid UUID := p_event_id;
  v_data JSONB;
BEGIN
  IF v_eid IS NULL THEN
    SELECT id INTO v_eid FROM public.events WHERE active = true ORDER BY created_at ASC LIMIT 1;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'eventId', p.event_id,
        'name', p.name,
        'category', p.category,
        'description', p.description,
        'photoUrl', p.photo_url,
        'isActive', p.is_active,
        'displayOrder', p.display_order,
        'performanceStatus', COALESCE(p.performance_status, 'UPCOMING'),
        'ratingsEnabled', COALESCE(p.ratings_enabled, false)
      )
      ORDER BY p.display_order ASC, p.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_data
  FROM public.performers p
  WHERE (v_eid IS NULL OR p.event_id = v_eid)
    AND p.is_active = true;

  RETURN v_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_performers(UUID) TO anon, authenticated;
