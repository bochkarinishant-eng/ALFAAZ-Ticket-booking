# Alfaaz Open Mic — Ticket Booking, Payment & QR Entry System

A production-ready full-stack event ticketing, payment verification, and door QR entry platform for **Alfaaz Open Mic**, built on a **100% Free & Serverless Stack**:
- **Frontend:** React 18, Vite 5, TypeScript, HTML5-QRCode scanner, and luxury editorial design.
- **Backend APIs:** Supabase Edge Functions (TypeScript / Deno runtime).
- **Database:** Supabase PostgreSQL with Row Level Security (RLS) & Atomic Stored Procedures.
- **Authentication:** Supabase Auth for Admin management.
- **Payment Processing:** 100% Direct UPI QR scan with 12-digit UTR submission (Zero gateway fees, zero third-party payment accounts).
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

## 📁 Clean Repository Structure

```
alfaz/
├── frontend/                   # React + Vite Application
│   ├── src/
│   │   ├── lib/supabase.ts     # Central Supabase client
│   │   ├── services/api.ts     # Typed Serverless API client
│   │   ├── App.jsx             # Main application UI & flows
│   │   ├── styles.css          # Editorial luxury theme
│   │   └── main.jsx
│   ├── public/                 # Static assets (UPI QR code)
│   ├── .env.example            # Vercel environment variables guide
│   └── package.json
│
├── supabase/                   # Serverless Backend & Database
│   ├── migrations/             # SQL Migrations (run in Supabase SQL editor)
│   │   ├── 20261107000001_initial_schema.sql
│   │   ├── 20261107000002_rls_policies.sql
│   │   └── 20261107000003_database_functions.sql
│   ├── functions/              # Deno Edge Functions
│   │   ├── create-booking/
│   │   ├── verify-payment/
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

For full instructions on setting up Supabase, applying SQL migrations, creating the Admin account, and deploying to Vercel, please read [`SUPABASE_MIGRATION_GUIDE.md`](SUPABASE_MIGRATION_GUIDE.md).
