-- ============================================================================
-- ALFAAZ OPEN MIC — ALLOW RATINGS WHEN PERFORMER IS PERFORMING OR COMPLETED
-- ============================================================================

-- Ensure event voting_status is OPEN
UPDATE public.events SET voting_status = 'OPEN' WHERE active = true;

CREATE OR REPLACE FUNCTION public.submit_performer_rating(
  p_event_id UUID,
  p_performer_id UUID,
  p_voter_token_hash TEXT,
  p_rating INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_performer public.performers%ROWTYPE;
BEGIN
  -- Validate rating bounds (1 to 5)
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rating must be an integer between 1 and 5 stars.');
  END IF;

  -- Validate device voter token
  IF p_voter_token_hash IS NULL OR trim(p_voter_token_hash) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid device rating token');
  END IF;

  -- 1. Check Event
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Only block if explicitly CLOSED
  IF v_event.voting_status = 'CLOSED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audience rating has concluded for this event.');
  END IF;

  -- If status is DRAFT, auto-promote to OPEN
  IF v_event.voting_status = 'DRAFT' THEN
    UPDATE public.events SET voting_status = 'OPEN', updated_at = now() WHERE id = p_event_id;
  END IF;

  -- 2. Check Performer & whether ratings are enabled
  SELECT * INTO v_performer
  FROM public.performers
  WHERE id = p_performer_id AND event_id = p_event_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Performer not found or not active');
  END IF;

  -- Allow if ratings_enabled is true OR performer is PERFORMING or COMPLETED
  IF NOT v_performer.ratings_enabled AND v_performer.performance_status NOT IN ('PERFORMING', 'COMPLETED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rating is not yet open for ' || v_performer.name || '. Please wait until their performance begins!'
    );
  END IF;

  -- 3. Check for existing rating from this device for this performer
  IF EXISTS (
    SELECT 1 FROM public.performance_ratings
    WHERE event_id = p_event_id
      AND performer_id = p_performer_id
      AND voter_token_hash = p_voter_token_hash
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already submitted a rating for ' || v_performer.name || '.');
  END IF;

  -- 4. Insert Rating
  INSERT INTO public.performance_ratings (event_id, performer_id, voter_token_hash, rating)
  VALUES (p_event_id, p_performer_id, p_voter_token_hash, p_rating);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Thank you! Your rating for ' || v_performer.name || ' has been recorded anonymously.',
    'performer_name', v_performer.name,
    'rating', p_rating
  );
END;
$$;
