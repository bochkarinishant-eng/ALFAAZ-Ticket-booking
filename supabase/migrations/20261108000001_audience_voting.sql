-- ============================================================================
-- ALFAAZ AUDIENCE CHOICE VOTING SYSTEM MIGRATION
-- ============================================================================

-- 1. ADD VOTING CONTROLS TO EVENTS TABLE
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS voting_status TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS voting_title TEXT NOT NULL DEFAULT 'Alfaaz Audience Choice Award';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS results_revealed BOOLEAN NOT NULL DEFAULT false;

-- 2. CREATE PERFORMERS TABLE
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

-- 3. CREATE VOTES TABLE (ANONYMOUS & CRYPTOGRAPHICALLY PREVENTS DUPLICATES)
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  performer_id UUID NOT NULL REFERENCES public.performers(id) ON DELETE CASCADE,
  voter_token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_voter UNIQUE (event_id, voter_token_hash)
);

-- 4. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_performers_event ON public.performers(event_id, is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_votes_event ON public.votes(event_id);
CREATE INDEX IF NOT EXISTS idx_votes_performer ON public.votes(performer_id);
CREATE INDEX IF NOT EXISTS idx_votes_token ON public.votes(event_id, voter_token_hash);

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.performers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- 6. POLICIES FOR PERFORMERS
-- Public can view only active performers
DROP POLICY IF EXISTS "Public can view active performers" ON public.performers;
CREATE POLICY "Public can view active performers"
  ON public.performers FOR SELECT
  USING (is_active = true);

-- Admins have full access to performers
DROP POLICY IF EXISTS "Admins have full access to performers" ON public.performers;
CREATE POLICY "Admins have full access to performers"
  ON public.performers FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7. POLICIES FOR VOTES
-- Public CANNOT view votes directly (Privacy protection)
-- Admins have full access to audit votes
DROP POLICY IF EXISTS "Admins have full access to votes" ON public.votes;
CREATE POLICY "Admins have full access to votes"
  ON public.votes FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 8. SECURE ATOMIC VOTE SUBMISSION FUNCTION
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
DECLARE
  v_event public.events%ROWTYPE;
  v_performer public.performers%ROWTYPE;
BEGIN
  -- Check voter token
  IF p_voter_token_hash IS NULL OR trim(p_voter_token_hash) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid device voting token');
  END IF;

  -- 1. Check Event & Voting Status
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_event.voting_status != 'OPEN' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Voting is currently closed for this event. Please wait for the host to announce!'
    );
  END IF;

  -- 2. Check Performer
  SELECT * INTO v_performer
  FROM public.performers
  WHERE id = p_performer_id AND event_id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected performer is not registered for this event');
  END IF;

  IF NOT v_performer.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'This performer is currently not eligible for voting');
  END IF;

  -- 3. Check for Duplicate Vote
  IF EXISTS (
    SELECT 1 FROM public.votes
    WHERE event_id = p_event_id AND voter_token_hash = p_voter_token_hash
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'alreadyVoted', true,
      'error', 'You have already cast your vote for this event! Each audience member can vote once.'
    );
  END IF;

  -- 4. Record Vote
  INSERT INTO public.votes (event_id, performer_id, voter_token_hash)
  VALUES (p_event_id, p_performer_id, p_voter_token_hash);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your vote for ' || v_performer.name || ' has been recorded! Thank you for supporting the artists of Alfaaz.',
    'performerName', v_performer.name
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'alreadyVoted', true,
      'error', 'You have already cast your vote for this event!'
    );
END;
$$;

-- 9. SECURE VOTING RESULTS FUNCTION (ADMIN OR PUBLIC REVEAL ONLY)
CREATE OR REPLACE FUNCTION public.get_voting_results(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_is_admin BOOLEAN;
  v_total_votes BIGINT;
  v_performers_json JSONB;
  v_max_votes BIGINT := 0;
  v_winner_count INT := 0;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Event not found');
  END IF;

  v_is_admin := public.is_admin();

  -- Privacy check: Only admin or when results are officially revealed
  IF NOT v_is_admin AND NOT v_event.results_revealed THEN
    RETURN jsonb_build_object(
      'resultsRevealed', false,
      'votingStatus', v_event.voting_status,
      'message', 'Voting results have not been revealed yet. Stay tuned to the stage announcement!'
    );
  END IF;

  -- Calculate total votes
  SELECT count(*) INTO v_total_votes
  FROM public.votes
  WHERE event_id = p_event_id;

  -- Aggregate performer votes
  WITH tally AS (
    SELECT
      p.id,
      p.name,
      p.category,
      p.description,
      p.photo_url,
      p.is_active,
      p.display_order,
      count(v.id) AS vote_count
    FROM public.performers p
    LEFT JOIN public.votes v ON v.performer_id = p.id AND v.event_id = p_event_id
    WHERE p.event_id = p_event_id
    GROUP BY p.id, p.name, p.category, p.description, p.photo_url, p.is_active, p.display_order
    ORDER BY vote_count DESC, p.display_order ASC, p.name ASC
  )
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'category', category,
        'description', description,
        'photoUrl', photo_url,
        'isActive', is_active,
        'displayOrder', display_order,
        'voteCount', vote_count,
        'percentage', CASE WHEN v_total_votes > 0 THEN round((vote_count::numeric / v_total_votes::numeric) * 100, 1) ELSE 0 END
      )
    ),
    COALESCE(max(vote_count), 0)
  INTO v_performers_json, v_max_votes
  FROM tally;

  -- Count winners if max votes > 0
  IF v_max_votes > 0 THEN
    SELECT count(*) INTO v_winner_count
    FROM (
      SELECT count(v.id) AS cnt
      FROM public.performers p
      LEFT JOIN public.votes v ON v.performer_id = p.id AND v.event_id = p_event_id
      WHERE p.event_id = p_event_id
      GROUP BY p.id
      HAVING count(v.id) = v_max_votes
    ) winners;
  END IF;

  RETURN jsonb_build_object(
    'eventId', v_event.id,
    'eventTitle', v_event.title,
    'votingTitle', v_event.voting_title,
    'votingStatus', v_event.voting_status,
    'resultsRevealed', v_event.results_revealed,
    'totalVotes', v_total_votes,
    'highestVotes', v_max_votes,
    'isTie', v_winner_count > 1,
    'winnerCount', v_winner_count,
    'performers', COALESCE(v_performers_json, '[]'::jsonb)
  );
END;
$$;

-- 10. UPDATE PUBLIC EVENT SUMMARY TO INCLUDE VOTING STATUS
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
  v_total_votes BIGINT;
  v_performer_count BIGINT;
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

  SELECT count(*) INTO v_total_votes
  FROM public.votes
  WHERE event_id = v_event.id;

  SELECT count(*) INTO v_performer_count
  FROM public.performers
  WHERE event_id = v_event.id AND is_active = true;

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
    'active', v_event.active,
    'votingStatus', v_event.voting_status,
    'votingTitle', v_event.voting_title,
    'resultsRevealed', v_event.results_revealed,
    'totalVotes', v_total_votes,
    'performerCount', v_performer_count
  );
END;
$$;

-- 11. SEED SAMPLE PERFORMERS FOR ALFAAZ OPEN MIC (IF TABLE IS EMPTY)
DO $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id FROM public.events WHERE active = true LIMIT 1;
  IF v_event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.performers WHERE event_id = v_event_id) THEN
    INSERT INTO public.performers (event_id, name, category, description, is_active, display_order)
    VALUES
      (v_event_id, 'Aarav Deshmukh', 'Poetry & Shayari', 'Spoken word piece on memories of Basmat and modern love.', true, 1),
      (v_event_id, 'Simran Kaur', 'Stand-up Comedy', 'Observational storytelling on small-town college life.', true, 2),
      (v_event_id, 'Rohan Patil', 'Acoustic Music', 'Original Hindi indie melody on acoustic guitar.', true, 3),
      (v_event_id, 'Pooja Sharma', 'Storytelling', 'Inspiring tale of discovering one’s voice through art.', true, 4),
      (v_event_id, 'Zaid Qureshi', 'Urdu Ghazal', 'Classical and contemporary Nazms with soulful delivery.', true, 5);
  END IF;
END $$;
