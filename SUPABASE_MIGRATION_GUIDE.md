# ALFAAZ Open Mic — Supabase Serverless Backend Guide

This project runs on a **100% Free & Serverless Stack**:
- **Database:** Supabase PostgreSQL with Row Level Security (RLS) & Atomic Stored Procedures.
- **Backend APIs:** Supabase Edge Functions (TypeScript on Deno runtime).
- **Authentication:** Supabase Auth for Admin management.
- **Payment Processing:** 100% Direct UPI QR scan with 12-digit UTR submission (Zero gateway fees, zero third-party payment accounts).
- **Frontend Hosting:** Vercel (100% Free Tier, Global CDN).
- **QR Ticket & Door Entry:** Cryptographic QR tokens, single-entry validation lock, instant PNG download, and browser printing.

---

## 1. Quick Step-by-Step Setup on Supabase (Free Tier)

### Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New Project** and name it `alfaaz-ticket-booking`.
3. Set a strong database password and select the region closest to your users (e.g., `South Asia (Mumbai)`).
4. Wait 1-2 minutes for the database to provision.

---

### Step 2: Apply SQL Migrations
In your Supabase project dashboard, navigate to the **SQL Editor** on the left menu:
1. Open [`supabase/migrations/20261107000001_initial_schema.sql`](./supabase/migrations/20261107000001_initial_schema.sql).
   - Paste the SQL into the Supabase SQL editor and click **Run**.
   - This creates tables: `events`, `ticket_types`, `profiles`, `bookings`, `payments`, `tickets`, `check_ins`, `admin_audit_logs`, and seeds the Alfaaz Open Mic event (₹100, 9 Nov 2026, 5 PM).
2. Open [`supabase/migrations/20261107000002_rls_policies.sql`](./supabase/migrations/20261107000002_rls_policies.sql).
   - Paste the SQL into the Supabase SQL editor and click **Run**.
   - This activates Row Level Security (RLS) across all tables with fine-grained access control.
3. Open [`supabase/migrations/20261107000003_database_functions.sql`](./supabase/migrations/20261107000003_database_functions.sql).
   - Paste the SQL into the Supabase SQL editor and click **Run**.
   - This creates the atomic door check-in procedure (`atomic_check_in`), the event availability summary function, and the auth user profile trigger.

---

### Step 3: Create the First Admin Account
1. In your Supabase dashboard, go to **Authentication** -> **Users**.
2. Click **Add User** -> **Create User**.
3. Enter:
   - **Email:** `admin@alfaaz.local` (or your personal email).
   - **Password:** `Alfaaz@2026` (or any strong password).
   - Check **Auto Confirm User?** -> Click **Create User**.
4. In the **SQL Editor**, run this query to grant Admin privileges:
   ```sql
   UPDATE public.profiles
   SET role = 'ADMIN'
   WHERE email = 'admin@alfaaz.local';
   ```

---

### Step 4: Deploy Supabase Edge Functions
Install the Supabase CLI if you haven't already:
```bash
npm install -g supabase
```
Login to your Supabase account:
```bash
supabase login
```
Link your local repository to your Supabase project (replace `<project-ref>` with your project reference found in Project Settings -> General):
```bash
supabase link --project-ref <project-ref>
```
Deploy all 6 Edge Functions:
```bash
supabase functions deploy create-booking
supabase functions deploy verify-payment
supabase functions deploy get-booking
supabase functions deploy get-ticket
supabase functions deploy validate-ticket
supabase functions deploy admin-management
```

---

## 2. Frontend Deployment on Vercel (100% Free)

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Pure serverless UPI payment & ticket booking system"
   git push origin main
   ```
2. Go to [https://vercel.com](https://vercel.com) and click **Add New** -> **Project**.
3. Import your `ALFAAZ-Ticket-booking` GitHub repository.
4. Set **Root Directory** to `frontend`.
5. Add the following **Environment Variables**:
   | Variable | Value | Description |
   | :--- | :--- | :--- |
   | `VITE_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` | Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | Supabase Anonymous Key |
6. Click **Deploy**. Your app is live within seconds on a fast global CDN!

---

## 3. How the UPI Payment & Ticket Flow Works

1. **Seat Reservation:** Customer enters their Name and 10-digit Phone number. A seat is temporarily reserved for 15 minutes.
2. **UPI QR Scan:** Customer is shown the Alfaaz UPI QR code and UPI ID (`8624890246@ibl`). They pay ₹100 via GPay, PhonePe, Paytm, or BHIM.
3. **UTR Submission:** Customer enters their 12-digit UPI Reference / UTR Number and clicks "Payment Completed · Submit UTR".
4. **Admin Approval:** Admin opens the Admin Dashboard, verifies the UTR against their UPI statement, and clicks **Approve**.
5. **Instant Ticket:** The customer's screen flips to their verified **Digital QR Entry Pass**, complete with a single-entry QR code, PDF download, and WhatsApp share link!
