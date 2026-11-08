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

## 6. Audience Choice Voting System Setup (SQL Editor)

To enable the **Alfaaz Audience Choice Award** voting system, open your **Supabase Dashboard** $\rightarrow$ **SQL Editor** $\rightarrow$ **New Query**, paste the contents of `supabase/migrations/20261108000001_audience_voting.sql`, and click **Run**:

```sql
-- 1. ADD VOTING CONTROLS TO EVENTS
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

-- 3. CREATE VOTES TABLE (ANONYMOUS & CRYPTOGRAPHIC DEVICE TOKEN LOCK)
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  performer_id UUID NOT NULL REFERENCES public.performers(id) ON DELETE CASCADE,
  voter_token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_voter UNIQUE (event_id, voter_token_hash)
);

CREATE INDEX IF NOT EXISTS idx_performers_event ON public.performers(event_id, is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_votes_event ON public.votes(event_id);
CREATE INDEX IF NOT EXISTS idx_votes_performer ON public.votes(performer_id);
CREATE INDEX IF NOT EXISTS idx_votes_token ON public.votes(event_id, voter_token_hash);

-- 4. ENABLE RLS POLICIES
ALTER TABLE public.performers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active performers" ON public.performers;
CREATE POLICY "Public can view active performers"
  ON public.performers FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins have full access to performers" ON public.performers;
CREATE POLICY "Admins have full access to performers"
  ON public.performers FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins have full access to votes" ON public.votes;
CREATE POLICY "Admins have full access to votes"
  ON public.votes FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. ATOMIC VOTE SUBMISSION FUNCTION
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
  IF p_voter_token_hash IS NULL OR trim(p_voter_token_hash) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid device voting token');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_event.voting_status != 'OPEN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voting is currently closed for this event.');
  END IF;

  SELECT * INTO v_performer FROM public.performers WHERE id = p_performer_id AND event_id = p_event_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected performer is not eligible for voting');
  END IF;

  IF EXISTS (SELECT 1 FROM public.votes WHERE event_id = p_event_id AND voter_token_hash = p_voter_token_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This device has already cast a vote for this event.');
  END IF;

  INSERT INTO public.votes (event_id, performer_id, voter_token_hash)
  VALUES (p_event_id, p_performer_id, p_voter_token_hash);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Your vote has been recorded! Thank you for supporting the artists of Alfaaz.',
    'performer_name', v_performer.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_vote(UUID, UUID, TEXT) TO anon, authenticated;

-- 6. PRIVATE RESULTS AGGREGATION & TIE DETECTION FUNCTION
CREATE OR REPLACE FUNCTION public.get_voting_results(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_is_admin BOOLEAN := false;
  v_total_votes INT := 0;
  v_highest_votes INT := 0;
  v_winner_count INT := 0;
  v_performers_json JSONB;
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

  IF NOT v_is_admin AND NOT v_event.results_revealed THEN
    RETURN jsonb_build_object(
      'error', 'Voting results are private and will be announced by the host on stage.'
    );
  END IF;

  SELECT count(*) INTO v_total_votes FROM public.votes WHERE event_id = p_event_id;

  SELECT COALESCE(jsonb_agg(sub.perf_record), '[]'::jsonb)
  INTO v_performers_json
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'category', p.category,
      'description', p.description,
      'photoUrl', p.photo_url,
      'voteCount', count(v.id),
      'displayOrder', p.display_order
    ) AS perf_record
    FROM public.performers p
    LEFT JOIN public.votes v ON v.performer_id = p.id AND v.event_id = p.event_id
    WHERE p.event_id = p_event_id AND p.is_active = true
    GROUP BY p.id, p.name, p.category, p.description, p.photo_url, p.display_order
    ORDER BY count(v.id) DESC, p.display_order ASC
  ) sub;

  IF v_total_votes > 0 THEN
    SELECT count(v.id) INTO v_highest_votes
    FROM public.votes v
    WHERE v.event_id = p_event_id
    GROUP BY v.performer_id
    ORDER BY count(v.id) DESC
    LIMIT 1;

    SELECT count(*) INTO v_winner_count
    FROM (
      SELECT performer_id
      FROM public.votes
      WHERE event_id = p_event_id
      GROUP BY performer_id
      HAVING count(*) = v_highest_votes
    ) winners;
  END IF;

  RETURN jsonb_build_object(
    'eventId', v_event.id,
    'eventTitle', v_event.title,
    'votingTitle', v_event.voting_title,
    'votingStatus', v_event.voting_status,
    'resultsRevealed', v_event.results_revealed,
    'totalVotes', v_total_votes,
    'highestVotes', v_highest_votes,
    'isTie', (v_winner_count > 1),
    'winnerCount', v_winner_count,
    'performers', v_performers_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_voting_results(UUID) TO anon, authenticated;
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
