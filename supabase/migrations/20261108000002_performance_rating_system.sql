-- ============================================================================
-- ALFAAZ AUDIENCE PERFORMANCE RATING & TOP 3 WINNER SYSTEM MIGRATION
-- Migration: 20261108000002_performance_rating_system.sql
-- ============================================================================

-- 1. UPDATE EVENTS TABLE FOR RATINGS & AWARDS
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS voting_status TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS voting_title TEXT NOT NULL DEFAULT 'Alfaaz Audience Performance Rating';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS results_revealed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS winners_calculated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS winner_award_1 TEXT NOT NULL DEFAULT 'Alfaaz Star Performer';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS winner_award_2 TEXT NOT NULL DEFAULT 'Alfaaz Outstanding Performer';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS winner_award_3 TEXT NOT NULL DEFAULT 'Alfaaz Rising Performer';

-- 2. UPDATE OR CREATE PERFORMERS TABLE WITH PERFORMANCE STAGE STATUS
CREATE TABLE IF NOT EXISTS public.performers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Poetry',
  description TEXT,
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.performers ADD COLUMN IF NOT EXISTS performance_status TEXT NOT NULL DEFAULT 'UPCOMING';
ALTER TABLE public.performers ADD COLUMN IF NOT EXISTS ratings_enabled BOOLEAN NOT NULL DEFAULT false;

-- 3. RECREATE VOTES / RATINGS TABLE
-- Each audience member (device) can rate each performer once (1-5 stars).
CREATE TABLE IF NOT EXISTS public.performance_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  performer_id UUID NOT NULL REFERENCES public.performers(id) ON DELETE CASCADE,
  voter_token_hash TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_performer_voter UNIQUE (event_id, performer_id, voter_token_hash)
);

-- Backward compatibility view if older code queries votes
CREATE OR REPLACE VIEW public.votes AS
  SELECT id, event_id, performer_id, voter_token_hash, rating, created_at
  FROM public.performance_ratings;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ratings_event_perf ON public.performance_ratings(event_id, performer_id);
CREATE INDEX IF NOT EXISTS idx_ratings_token ON public.performance_ratings(event_id, performer_id, voter_token_hash);
CREATE INDEX IF NOT EXISTS idx_performers_status ON public.performers(event_id, performance_status, ratings_enabled);

-- 4. ROW LEVEL SECURITY
ALTER TABLE public.performance_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to ratings" ON public.performance_ratings;
CREATE POLICY "Admins have full access to ratings"
  ON public.performance_ratings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Public CANNOT view raw ratings table directly (privacy protection)

-- 5. SECURE ATOMIC RATING SUBMISSION FUNCTION
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

  IF v_event.voting_status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audience rating is currently closed for this event.');
  END IF;

  -- 2. Check Performer & whether ratings are enabled for this artist
  SELECT * INTO v_performer
  FROM public.performers
  WHERE id = p_performer_id AND event_id = p_event_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Performer not found or not active');
  END IF;

  IF NOT v_performer.ratings_enabled THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rating is not yet enabled for ' || v_performer.name || '. Please wait until their performance is completed!'
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
    'message', 'Thank you! Your rating for ' || v_performer.name || ' has been recorded.',
    'performer_id', v_performer.id,
    'performer_name', v_performer.name,
    'rating', p_rating
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_performer_rating(UUID, UUID, TEXT, INT) TO anon, authenticated;

-- Backward compatibility wrapper for old submit_vote calls
CREATE OR REPLACE FUNCTION public.submit_vote(
  p_event_id UUID,
  p_performer_id UUID,
  p_voter_token_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.submit_performer_rating(p_event_id, p_performer_id, p_voter_token_hash, 5);
END;
$$;

-- 6. PRIVATE ADMIN RESULTS AGGREGATION & TOP 3 WINNER CALCULATION
CREATE OR REPLACE FUNCTION public.get_admin_rating_results(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_is_admin BOOLEAN := false;
  v_total_ratings INT := 0;
  v_performers_json JSONB;
  v_top3_json JSONB;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Event not found');
  END IF;

  BEGIN
    v_is_admin := public.is_admin();
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'Unauthorized. Admin access required.');
  END IF;

  SELECT count(*) INTO v_total_ratings FROM public.performance_ratings WHERE event_id = p_event_id;

  -- Aggregate full stats per performer:
  -- average rating (raw float & rounded), total ratings, distribution (1 to 5 stars)
  SELECT COALESCE(jsonb_agg(perf_stat), '[]'::jsonb)
  INTO v_performers_json
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'category', p.category,
      'description', p.description,
      'photoUrl', p.photo_url,
      'displayOrder', p.display_order,
      'performanceStatus', p.performance_status,
      'ratingsEnabled', p.ratings_enabled,
      'totalRatings', count(r.id),
      'totalPoints', COALESCE(sum(r.rating), 0),
      'averageRating', CASE WHEN count(r.id) > 0 THEN round(avg(r.rating)::numeric, 2) ELSE 0.00 END,
      'rawAverage', CASE WHEN count(r.id) > 0 THEN avg(r.rating) ELSE 0.00 END,
      'star1', count(r.id) FILTER (WHERE r.rating = 1),
      'star2', count(r.id) FILTER (WHERE r.rating = 2),
      'star3', count(r.id) FILTER (WHERE r.rating = 3),
      'star4', count(r.id) FILTER (WHERE r.rating = 4),
      'star5', count(r.id) FILTER (WHERE r.rating = 5)
    ) AS perf_stat
    FROM public.performers p
    LEFT JOIN public.performance_ratings r ON r.performer_id = p.id AND r.event_id = p.event_id
    WHERE p.event_id = p_event_id AND p.is_active = true
    GROUP BY p.id, p.name, p.category, p.description, p.photo_url, p.display_order, p.performance_status, p.ratings_enabled
    ORDER BY
      CASE WHEN count(r.id) > 0 THEN avg(r.rating) ELSE 0 END DESC,
      count(r.id) DESC,
      p.display_order ASC
  ) sub;

  -- Calculate Top 3 winners (only ranked if they have at least 1 valid rating)
  SELECT COALESCE(jsonb_agg(top_row), '[]'::jsonb)
  INTO v_top3_json
  FROM (
    SELECT
      p.id,
      p.name,
      p.category,
      p.photo_url AS "photoUrl",
      count(r.id) AS "totalRatings",
      round(avg(r.rating)::numeric, 2) AS "averageRating",
      avg(r.rating) AS "rawAverage",
      RANK() OVER (ORDER BY avg(r.rating) DESC, count(r.id) DESC) as "rank"
    FROM public.performers p
    JOIN public.performance_ratings r ON r.performer_id = p.id AND r.event_id = p.event_id
    WHERE p.event_id = p_event_id AND p.is_active = true
    GROUP BY p.id, p.name, p.category, p.photo_url
    HAVING count(r.id) > 0
    ORDER BY avg(r.rating) DESC, count(r.id) DESC
    LIMIT 3
  ) top_row;

  RETURN jsonb_build_object(
    'eventId', v_event.id,
    'eventTitle', v_event.title,
    'votingTitle', v_event.voting_title,
    'votingStatus', v_event.voting_status,
    'resultsRevealed', v_event.results_revealed,
    'winnersCalculated', v_event.winners_calculated,
    'winnerAwards', jsonb_build_object(
      'first', v_event.winner_award_1,
      'second', v_event.winner_award_2,
      'third', v_event.winner_award_3
    ),
    'totalRatings', v_total_ratings,
    'performers', v_performers_json,
    'top3Winners', v_top3_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_rating_results(UUID) TO authenticated;

-- 7. PUBLIC FUNCTION TO FETCH TOP 3 WINNERS (ONLY WHEN ADMIN REVEALS THEM)
CREATE OR REPLACE FUNCTION public.get_public_winners(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_top3_json JSONB;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Event not found');
  END IF;

  -- Only reveal if admin has officially toggled results_revealed = true
  IF NOT v_event.results_revealed THEN
    RETURN jsonb_build_object(
      'revealed', false,
      'message', 'Winners have not been announced yet. Stay tuned!'
    );
  END IF;

  SELECT COALESCE(jsonb_agg(top_row), '[]'::jsonb)
  INTO v_top3_json
  FROM (
    SELECT
      p.id,
      p.name,
      p.category,
      p.photo_url AS "photoUrl",
      round(avg(r.rating)::numeric, 2) AS "averageRating",
      count(r.id) AS "totalRatings",
      DENSE_RANK() OVER (ORDER BY avg(r.rating) DESC, count(r.id) DESC) as "rank"
    FROM public.performers p
    JOIN public.performance_ratings r ON r.performer_id = p.id AND r.event_id = p.event_id
    WHERE p.event_id = p_event_id AND p.is_active = true
    GROUP BY p.id, p.name, p.category, p.photo_url
    HAVING count(r.id) > 0
    ORDER BY avg(r.rating) DESC, count(r.id) DESC
    LIMIT 3
  ) top_row;

  RETURN jsonb_build_object(
    'revealed', true,
    'eventId', v_event.id,
    'eventTitle', v_event.title,
    'winnerAwards', jsonb_build_object(
      'first', v_event.winner_award_1,
      'second', v_event.winner_award_2,
      'third', v_event.winner_award_3
    ),
    'winners', v_top3_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_winners(UUID) TO anon, authenticated;

-- 8. SEED SAMPLE PERFORMERS WITH STAGE STATUS IF EMPTY
DO $$
DECLARE
  v_eid UUID;
BEGIN
  SELECT id INTO v_eid FROM public.events LIMIT 1;
  IF v_eid IS NOT NULL THEN
    -- Ensure existing performers have proper defaults
    UPDATE public.performers
    SET performance_status = 'COMPLETED', ratings_enabled = true
    WHERE event_id = v_eid AND ratings_enabled IS NULL;
  END IF;
END $$;
