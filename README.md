# Alfaaz Open Mic — Ticket Booking, Payment & QR Entry System

A production-ready full-stack event ticketing, payment verification, and door QR entry platform for **Alfaaz Open Mic**, built on a **100% Free & Serverless Stack**:
- **Frontend:** React 18, Vite 5, TypeScript, HTML5-QRCode scanner, and luxury editorial design.
- **Backend APIs:** Supabase Edge Functions (TypeScript / Deno runtime).
- **Database:** Supabase PostgreSQL with Row Level Security (RLS) & Atomic Stored Procedures.
- **Authentication:** Supabase Auth for Admin management.
- **Payment Processing:** **Dual Payment Mode**:
  1. Automated Razorpay Checkout (UPI, Google Pay, PhonePe, Cards, NetBanking) with HMAC SHA-256 verification.
  2. Direct manual UPI QR code scan (`8624890246@ibl`) with 12-digit UTR submission.
- **Hosting:** Vercel (Frontend) + Supabase (Database & APIs).

---

## 🎭 Event Details
- **Event:** Alfaaz Open Mic
- **Organizer:** Alfaaz
- **Date & Time:** Monday, 9 November 2026 at 5:00 PM
- **Venue:** Beyond Temptation, Ashegaon Road, Basmat
- **Capacity:** Strictly capped at **40 seats**
- **Ticket Price:** Flat **₹100** (Audience or Performer slot)
- **UPI ID:** `8624890246@ibl`
- **Helpline Contact:** `+91 8624890246`

---

## 📁 Repository Structure

```
alfaz/
├── frontend/                   # React + Vite Application
│   ├── src/
│   │   ├── lib/supabase.ts     # Central Supabase client
│   │   ├── services/api.ts     # Typed Serverless API client
│   │   ├── App.jsx             # Main UI (Razorpay + UPI + QR Ticket)
│   │   ├── styles.css          # Editorial luxury theme
│   │   └── main.jsx
│   ├── public/                 # Static assets (UPI QR code)
│   ├── .env.example            # Environment variables template
│   └── package.json
│
├── supabase/                   # Serverless Backend & Database
│   ├── migrations/             # PostgreSQL SQL schema migrations
│   ├── functions/              # Deno Edge Functions
│   │   ├── create-booking/
│   │   ├── create-payment-order/
│   │   ├── verify-payment/
│   │   ├── razorpay-webhook/
│   │   ├── get-booking/
│   │   ├── get-ticket/
│   │   ├── validate-ticket/
│   │   └── admin-management/
│   └── config.toml
│
├── start-frontend.bat          # 1-click script to run React dev server
├── SUPABASE_MIGRATION_GUIDE.md # Complete setup and deployment guide
└── README.md
```

---

## 🚀 Local Development

1. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```
   *(Or simply double-click `start-frontend.bat` on Windows)*

3. Open your browser at [http://localhost:5173](http://localhost:5173).

---

## 📖 Deployment Guide

For full instructions on setting up Supabase, Razorpay API keys, Edge Functions, and deploying to Vercel, please read [`SUPABASE_MIGRATION_GUIDE.md`](SUPABASE_MIGRATION_GUIDE.md).
