# ALFAAZ Open Mic — Supabase Serverless & Razorpay Integration Guide

This project runs on a **Serverless Full-Stack Architecture**:
- **Database:** Supabase PostgreSQL with Row Level Security (RLS) & Atomic Stored Procedures.
- **Backend APIs:** Supabase Edge Functions (TypeScript on Deno runtime).
- **Authentication:** Supabase Auth for Admin management.
- **Payment Processing:** **Dual Payment Gateway Mode**:
  1. **Automated Razorpay Checkout:** Instant online payment via UPI, Google Pay, PhonePe, Debit/Credit Cards, and NetBanking with server-side HMAC SHA-256 signature verification.
  2. **Direct UPI QR Code (Fallback):** Manual UPI transfer to `8624890246@ibl` with 12-digit UTR submission and Admin verification.
- **Frontend Hosting:** Vercel (Global CDN).
- **QR Ticket & Door Entry:** Cryptographic QR tokens, single-entry validation lock, instant PNG download, and browser printing.

---

## 1. Supabase Database Migration (SQL Editor)

Run the following query in your **Supabase SQL Editor** to add Razorpay tracking columns:

```sql
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(razorpay_order_id);
```

---

## 2. Set Razorpay Secrets in Supabase

Open your PowerShell terminal and set your Razorpay credentials (found in [Razorpay Dashboard](https://dashboard.razorpay.com/) $\rightarrow$ **Account & Settings** $\rightarrow$ **API Keys**):

```powershell
cd C:\Users\nisha\OneDrive\Desktop\alfaz
supabase secrets set RAZORPAY_KEY_ID="rzp_live_xxxxxxxxxx"
supabase secrets set RAZORPAY_KEY_SECRET="your_razorpay_secret"
supabase secrets set RAZORPAY_WEBHOOK_SECRET="your_webhook_secret"
```
*(Note: You can use test keys like `rzp_test_...` for testing, and switch to live keys `rzp_live_...` when going live).*

---

## 3. Deploy Supabase Edge Functions

Deploy the payment and ticket functions:

```powershell
supabase functions deploy create-booking --no-verify-jwt
supabase functions deploy create-payment-order --no-verify-jwt
supabase functions deploy verify-payment --no-verify-jwt
supabase functions deploy razorpay-webhook --no-verify-jwt
supabase functions deploy get-booking --no-verify-jwt
supabase functions deploy get-ticket --no-verify-jwt
supabase functions deploy validate-ticket --no-verify-jwt
supabase functions deploy admin-management
```

---

## 4. Frontend Configuration (Vercel & Local)

### In Vercel Environment Variables:
Add the following under **Project Settings** $\rightarrow$ **Environment Variables**:
| Variable | Value | Description |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://rvhiwnlshcdqqqqtwjfz.supabase.co` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | *(your Supabase anon key)* | Supabase Anonymous Key |
| `VITE_RAZORPAY_KEY_ID` | `rzp_live_xxxxxxxxxx` *(or test key)* | Razorpay Key ID (Public) |

### In Local `frontend/.env`:
```env
VITE_SUPABASE_URL=https://rvhiwnlshcdqqqqtwjfz.supabase.co
VITE_SUPABASE_ANON_KEY=your_copied_anon_key_here
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxx
```

---

## 5. Webhook Setup on Razorpay (Optional but Recommended)

1. Go to your [Razorpay Dashboard](https://dashboard.razorpay.com/) $\rightarrow$ **Settings** $\rightarrow$ **Webhooks**.
2. Click **Add New Webhook**.
3. **Webhook URL:** `https://rvhiwnlshcdqqqqtwjfz.supabase.co/functions/v1/razorpay-webhook`
4. **Secret:** Same value as `RAZORPAY_WEBHOOK_SECRET`.
5. **Active Events:**
   * `payment.captured`
   * `order.paid`
   * `payment.failed`
6. Click **Save Webhook**.

---

## 6. Audience Performance Rating & Top 3 Winner Calculation Setup (SQL Editor)

To enable the **Alfaaz Audience Performance Rating System** and **Top 3 Winner Calculation**, open your **Supabase Dashboard** $\rightarrow$ **SQL Editor** $\rightarrow$ **New Query**, paste the contents of `supabase/migrations/20261108000002_performance_rating_system.sql`, and click **Run**:

```sql
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

-- 3. CREATE PERFORMANCE RATINGS TABLE (1-5 STARS PER PERFORMER PER DEVICE)
CREATE TABLE IF NOT EXISTS public.performance_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  performer_id UUID NOT NULL REFERENCES public.performers(id) ON DELETE CASCADE,
  voter_token_hash TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_performer_voter UNIQUE (event_id, performer_id, voter_token_hash)
);

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
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rating must be an integer between 1 and 5 stars.');
  END IF;

  IF p_voter_token_hash IS NULL OR trim(p_voter_token_hash) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid device rating token');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_event.voting_status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audience rating is currently closed for this event.');
  END IF;

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

  IF EXISTS (
    SELECT 1 FROM public.performance_ratings
    WHERE event_id = p_event_id
      AND performer_id = p_performer_id
      AND voter_token_hash = p_voter_token_hash
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already submitted a rating for ' || v_performer.name || '.');
  END IF;

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

-- 7. PUBLIC WINNER CEREMONY FUNCTION (REVEALED ONLY WHEN ADMIN TOGGLES)
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
```

---

## 7. How to Test Audience Choice Voting

1. **Public Voting URL:** Visit `http://localhost:5173/vote` or `https://your-domain.vercel.app/vote` (or `?page=vote`).
2. **Admin Command Dashboard:**
   - Go to `http://localhost:5173/?page=admin` and sign in.
   - Click the **🏆 Audience Voting** tab.
   - Click **▶️ Start Voting** to change the status to `OPEN`.
   - Click **📺 Stage Projector Mode** to display the fullscreen QR code on the venue projector.
   - Audience scans the QR code, taps their favourite performer, and clicks **Confirm Vote**.
   - Watch the live private bar chart update in real time with automated percentages and tie detection!
   - When the event concludes, click **⏸️ Stop Voting** and click **🏆 Reveal Winner on Stage** to display the winner announcement banner on the audience's screens!
