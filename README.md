# Alfaaz Open Mic — Complete Ticket Booking, Payment & QR Entry System

A production-ready full-stack event ticketing, seat management, UPI payment verification, and door QR entry check-in platform built for **Alfaaz Open Mic**.

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

## 🛠️ Tech Stack
- **Backend:** Java 21+ / Spring Boot 3.4.3 / Spring Data JPA / Spring Security / OpenPDF / ZXing
- **Frontend:** React 18 / Vite 5 / HTML5-QRCode / Modern Editorial CSS
- **Database:** MySQL 8.0+ (`alfaaz_tickets`)

---

## 🚀 Quick Start (Local Setup)

### 1. Prerequisites
- **Java 21** or higher
- **Node.js 20** or higher
- **MySQL Server 8.0** or higher running on port `3306`

---

### 2. Database Setup

#### Option A: Automatic Auto-DDL (Zero Effort)
Spring Boot is configured with `spring.jpa.hibernate.ddl-auto=update` and `createDatabaseIfNotExist=true`.
On first launch, Spring Boot will **automatically create the database `alfaaz_tickets`, build all tables, and seed the initial active event and admin user**.

#### Option B: Manual SQL Setup (Recommended for Custom Deployments)
You can run the included [`database_setup.sql`](database_setup.sql) directly in MySQL:
```bash
mysql -u root -p < database_setup.sql
```

---

### 3. Environment Configuration
The backend reads database credentials from environment variables with sensible local defaults:

| Variable | Default Value | Description |
|---|---|---|
| `DB_HOST` | `localhost` | MySQL host address |
| `DB_PORT` | `3306` | MySQL port |
| `DB_NAME` | `alfaaz_tickets` | Database name |
| `DB_USERNAME` | `root` | MySQL user |
| `DB_PASSWORD` | `Nishant@2611` | MySQL password |
| `ADMIN_USERNAME`| `admin` | Admin dashboard username |
| `ADMIN_PASSWORD`| `Alfaaz@2026` | Admin dashboard password |
| `UPI_ID` | `8624890246@ibl` | Organizer UPI ID for payments |
| `ORGANIZER_CONTACT`| `8624890246` | Helpline contact number |

*(To run with custom database credentials, simply set `DB_USERNAME` and `DB_PASSWORD` in your terminal or deployment environment).*

---

### 4. Running the Project

#### One-Click Windows Launch:
Double-click [`start-all.bat`](start-all.bat) in the project root to start both backend and frontend automatically.

#### Or Manual Terminal Launch:

**Terminal 1 — Backend:**
```bash
cd backend
mvn spring-boot:run
```
Backend runs at: `http://localhost:8080/api`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: `http://localhost:5173/`

---

## 🔐 Admin Portal & Door QR Scanner
- **URL:** [http://localhost:5173/?page=admin](http://localhost:5173/?page=admin)
- **Username:** `admin`
- **Password:** `Alfaaz@2026`

### Admin Features:
1. **Real-time Capacity Statistics:** Total 40 seats, confirmed, remaining, pending reviews, checked-in count.
2. **Payment Verification Queue:** Review submitted 12-digit UTR references with 1-click **Approve & Issue Ticket** or **Reject**.
3. **All Bookings Table:** Search by name, phone, UTR, or booking ID. Filter by category (Audience / Performer) and status.
4. **📷 Door QR Scanner (Gate Camera):** Scan attendees' digital or printed QR tickets using mobile/web camera. Displays **ENTRY APPROVED**, **ALREADY CHECKED IN**, or **INVALID TICKET** with atomic database locking.
5. **Attendee CSV Export:** 1-click export of verified attendees list.

---

## 🎟️ Attendee Workflow & Self-Service
1. **Booking:** Attendee enters Full Name and 10-Digit Mobile Number.
2. **UPI Payment:** Attendee scans `8624890246@ibl` QR, pays ₹100, and submits 12-digit UTR.
3. **Real-Time Auto-Flip:** The user's screen polls status every 3 seconds. Once the admin clicks **Approve**, the attendee's page immediately transforms into their confirmed entry ticket and QR code.
4. **Ticket Actions:**
   - Download high-res PDF Ticket (with embedded QR code)
   - Download QR Code as PNG image
   - Save Ticket link directly to WhatsApp with 1 click
   - Print Ticket layout
5. **Find My Ticket:** Any attendee can pull up their ticket anytime using strictly their **10-digit mobile number** (no complicated booking reference needed).

---

## 📦 GitHub Deployment Checklist
When pushing to GitHub:
- `backend/target/` and `frontend/node_modules/` are cleanly excluded via `.gitignore`.
- Database auto-seeds event details and admin account on startup.
- Full SQL dump is provided in [`database_setup.sql`](database_setup.sql).
