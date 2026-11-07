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
