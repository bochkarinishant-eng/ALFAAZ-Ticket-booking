import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import * as api from './services/api';

export default function App() {
  const [page, setPage] = useState('home'); // home, book, payment, confirmation, myticket, admin
  const [event, setEvent] = useState({
    id: 'e1fa0000-0000-0000-0000-000000000001',
    title: 'Alfaaz Open Mic',
    organizer: 'Alfaaz',
    eventDateTime: '2026-11-09T17:00:00',
    venue: 'Beyond Temptation, Ashegaon Road, Basmat',
    maxCapacity: 40,
    confirmedSeats: 0,
    reservedSeats: 0,
    availableSeats: 40,
    audiencePrice: 100,
    performerPrice: 100,
    contactPhone: '8624890246',
    upiId: '8624890246@ibl',
    active: true
  });

  // Clear any old temporary demo data
  useEffect(() => {
    try {
      localStorage.removeItem('alfaaz_active_booking');
    } catch {
      // ignore
    }
  }, []);

  // Booking Flow State
  const [bookingForm, setBookingForm] = useState({
    fullName: '',
    mobile: '',
    isPerformer: false,
    performerCategory: 'Poetry',
    performanceDescription: ''
  });
  const [bookingReserve, setBookingReserve] = useState(null);
  const [utrNumber, setUtrNumber] = useState('');
  const [isReserving, setIsReserving] = useState(false);
  const [isSubmittingUtr, setIsSubmittingUtr] = useState(false);
  const [isPaymentSubmitted, setIsPaymentSubmitted] = useState(false);
  const [confirmedTicket, setConfirmedTicket] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Admin Scanner State
  const scannerRef = useRef(null);
  const [scanResult, setScanResult] = useState(null);
  const [isScanningActive, setIsScanningActive] = useState(false);

  // Admin State
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('alfaaz_admin_token') || '');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [adminStats, setAdminStats] = useState(null);
  const [adminBookings, setAdminBookings] = useState([]);
  const [adminTab, setAdminTab] = useState('payments'); // payments, bookings, scanner, attendance
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilterCategory, setAdminFilterCategory] = useState('ALL');
  const [adminFilterStatus, setAdminFilterStatus] = useState('ALL');

  // Global Alert / Toast
  const [notice, setNotice] = useState(null);

  const showNotice = (msg, type = 'info') => {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 6000);
  };

  // 1. Initial Load: Fetch event & inspect URL parameters
  async function loadEventDetails() {
    try {
      const data = await api.getActiveEvent();
      if (data) {
        setEvent(data);
      }
    } catch {
      // Backend starting or offline
    }
  }

  useEffect(() => {
    loadEventDetails();
    const timer = setInterval(loadEventDetails, 15000);
    return () => clearInterval(timer);
  }, []);

  // Inspect URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticketKey = params.get('ticket');
    const targetPage = params.get('page');

    if (ticketKey) {
      loadTicketByAccessKey(ticketKey);
    } else if (targetPage === 'scanner') {
      const token = sessionStorage.getItem('alfaaz_admin_token');
      if (token) {
        setPage('admin');
        setAdminTab('scanner');
      } else {
        setPage('admin');
        showNotice('Door QR Scanner is restricted. Please sign in as admin.', 'info');
      }
    } else if (targetPage === 'admin') {
      setPage('admin');
    } else if (targetPage === 'myticket') {
      setPage('myticket');
    }
  }, []);

  // Generate QR code data URL whenever confirmed ticket changes
  useEffect(() => {
    if (confirmedTicket) {
      const token = confirmedTicket.qrToken || confirmedTicket.accessKey;
      if (token) {
        QRCode.toDataURL(token, {
          width: 320,
          margin: 2,
          color: { dark: '#4A1422', light: '#FFFFFF' }
        })
          .then(url => setQrDataUrl(url))
          .catch(() => {});
      } else if (confirmedTicket.qrBase64) {
        setQrDataUrl(`data:image/png;base64,${confirmedTicket.qrBase64}`);
      }
    }
  }, [confirmedTicket]);

  // Load ticket by access key
  async function loadTicketByAccessKey(key) {
    try {
      const data = await api.getConfirmedTicket(key.trim());
      setConfirmedTicket(data);
      setPage('confirmation');
      window.scrollTo(0, 0);
    } catch (err) {
      showNotice(err.message || 'Ticket not found or unconfirmed', 'error');
    }
  }

  // 2. Booking Step 1: Submit Reservation
  async function handleReserveSeat(e) {
    e.preventDefault();
    if (!bookingForm.fullName.trim() || !bookingForm.mobile.trim()) {
      showNotice('Please enter your full name and 10-digit mobile number.', 'error');
      return;
    }
    const cleanPhone = bookingForm.mobile.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      showNotice('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }

    setIsReserving(true);
    try {
      const ticketType = bookingForm.isPerformer ? 'Performer' : 'Audience';
      const payload = {
        fullName: bookingForm.fullName.trim(),
        mobile: bookingForm.mobile.trim(),
        ticketType: ticketType,
        performerCategory: bookingForm.isPerformer ? bookingForm.performerCategory : null,
        performanceDescription: bookingForm.isPerformer ? bookingForm.performanceDescription : null
      };

      const data = await api.reserveSeat(payload);

      setBookingReserve(data);
      setIsPaymentSubmitted(false);
      setUtrNumber('');
      setPage('payment');
      window.scrollTo(0, 0);
      loadEventDetails();
    } catch (err) {
      showNotice(err.message || 'Could not reserve seat', 'error');
    } finally {
      setIsReserving(false);
    }
  }

  // 3. Booking Step 2: Submit UPI UTR
  async function handleSubmitUtr(e) {
    e.preventDefault();
    if (!utrNumber.trim() || utrNumber.trim().length < 6) {
      showNotice('Please enter a valid UPI Reference / UTR Number (minimum 6 digits).', 'error');
      return;
    }

    setIsSubmittingUtr(true);
    try {
      await api.submitPaymentUtr(bookingReserve.bookingReference, utrNumber.trim());
      setIsPaymentSubmitted(true);
      showNotice('Payment reference submitted! Verification in progress.', 'success');
    } catch (err) {
      showNotice(err.message || 'Could not submit payment reference', 'error');
    } finally {
      setIsSubmittingUtr(false);
    }
  }

  // Auto-polling when payment is submitted: screen flips to confirmed ticket as soon as admin approves
  useEffect(() => {
    if (page !== 'payment' || !bookingReserve || !isPaymentSubmitted) return;

    const interval = setInterval(async () => {
      try {
        const status = await api.getBookingStatus(bookingReserve.bookingReference);
        if (status.bookingStatus === 'CONFIRMED' || status.paymentStatus === 'VERIFIED') {
          clearInterval(interval);
          loadTicketByAccessKey(bookingReserve.accessKey);
        }
      } catch {
        // Polling retry
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [page, bookingReserve, isPaymentSubmitted]);

  // Lookup booking by MOBILE NUMBER or booking reference
  async function handleLookupBooking(queryArg) {
    const q = (typeof queryArg === 'string' ? queryArg : lookupQuery).trim();
    setLookupError('');
    if (!q) return;

    setLookupLoading(true);
    if (q.startsWith('http') && q.includes('ticket=')) {
      const match = q.match(/ticket=([a-zA-Z0-9]+)/);
      if (match) {
        setLookupLoading(false);
        loadTicketByAccessKey(match[1]);
        return;
      }
    }

    try {
      const data = await api.getBookingStatus(q);
      if (data.bookingStatus === 'CONFIRMED') {
        await loadTicketByAccessKey(data.accessKey);
        return;
      } else {
        setBookingReserve({
          bookingReference: data.bookingReference,
          accessKey: data.accessKey,
          amount: data.amount,
          ticketType: data.ticketType,
          reservedUntil: data.reservedUntil,
          upiId: event.upiId,
          contactPhone: event.contactPhone
        });
        setIsPaymentSubmitted(data.paymentStatus === 'SUBMITTED');
        setPage('payment');
        window.scrollTo(0, 0);
        return;
      }
    } catch (err) {
      setLookupError(err.message || 'No booking found for this mobile number or reference. Please check and try again.');
    } finally {
      setLookupLoading(false);
    }
  }

  // 4. Ticket Actions: PDF, QR, Print, WhatsApp, Copy Link
  function downloadPdf() {
    window.print();
  }

  function downloadQrPng() {
    if (!confirmedTicket) return;
    const link = document.createElement('a');
    link.href = qrDataUrl || `data:image/png;base64,${confirmedTicket.qrBase64 || ''}`;
    link.download = `Alfaaz-Ticket-${confirmedTicket.ticketNumber}-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function printTicket() {
    window.print();
  }

  function copyTicketLink() {
    if (!confirmedTicket) return;
    const url = `${window.location.origin}/?ticket=${confirmedTicket.accessKey}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    });
  }

  function shareTicketOnWhatsApp() {
    if (!confirmedTicket) return;
    const url = `${window.location.origin}/?ticket=${confirmedTicket.accessKey}`;
    const attendeeName = confirmedTicket.fullName || confirmedTicket.attendeeName || 'Guest';
    const text = encodeURIComponent(
      `🎙️ *Alfaaz Open Mic Ticket Confirmed!*\n\n` +
      `👤 Attendee: ${attendeeName}\n` +
      `🎟️ Ticket ID: ${confirmedTicket.ticketNumber}\n` +
      `📅 Date: Monday, 9 November 2026 at 5:00 PM\n` +
      `📍 Venue: Beyond Temptation, Ashegaon Road, Basmat\n\n` +
      `🔗 Open & show entry QR pass:\n${url}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  // 5. Door Camera Scanner (Admin Tab Only)
  useEffect(() => {
    if (page !== 'admin' || adminTab !== 'scanner') {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      setIsScanningActive(false);
      return;
    }

    let isStopped = false;
    const scanner = new Html5Qrcode('admin-qr-reader');
    scannerRef.current = scanner;

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            if (isStopped) return;
            await scanner.pause(true);
            try {
              const result = await api.checkInTicket(decodedText.trim());
              setScanResult(result);
            } catch (err) {
              setScanResult({
                success: false,
                status: 'NETWORK_ERROR',
                message: err.message || 'Failed to verify ticket with backend.'
              });
            }
          },
          () => {}
        );
        setIsScanningActive(true);
      } catch (err) {
        showNotice(`Camera access error: ${err?.message || err}`, 'error');
      }
    };

    startScanner();

    return () => {
      isStopped = true;
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, [page, adminTab]);

  function resumeScanning() {
    setScanResult(null);
    if (scannerRef.current) {
      try {
        scannerRef.current.resume();
      } catch {
        // Safe resume
      }
    }
  }

  // 6. Admin Authentication & Actions
  async function handleAdminLogin(e) {
    e.preventDefault();
    setAdminLoginError('');
    try {
      const data = await api.adminLogin(adminUsername.trim(), adminPassword);
      setAdminToken(data.token);
      sessionStorage.setItem('alfaaz_admin_token', data.token);
      loadAdminDashboard(data.token);
    } catch (err) {
      setAdminLoginError(err.message || 'Invalid username or password');
    }
  }

  function handleAdminLogout() {
    api.adminLogout().catch(() => {});
    setAdminToken('');
    sessionStorage.removeItem('alfaaz_admin_token');
  }

  async function loadAdminDashboard(token = adminToken) {
    if (!token) return;
    try {
      const [stats, bookings] = await Promise.all([
        api.getAdminStats(token),
        api.getAdminBookings(token)
      ]);
      if (stats) setAdminStats(stats);
      if (bookings) setAdminBookings(bookings);
    } catch (err) {
      if (err.message && (err.message.includes('403') || err.message.includes('401') || err.message.includes('denied'))) {
        handleAdminLogout();
      }
    }
  }

  useEffect(() => {
    if (page === 'admin' && adminToken) {
      loadAdminDashboard(adminToken);
      const timer = setInterval(() => loadAdminDashboard(adminToken), 8000);
      return () => clearInterval(timer);
    }
  }, [page, adminToken]);

  async function handleApprovePayment(paymentId) {
    try {
      await api.adminApprovePayment(adminToken, paymentId);
      showNotice('Payment approved! Ticket confirmed & entry QR issued.', 'success');
      loadAdminDashboard();
      loadEventDetails();
    } catch (err) {
      showNotice(err.message || 'Could not approve payment', 'error');
    }
  }

  async function handleRejectPayment(paymentId) {
    const reason = prompt('Please enter a rejection reason (e.g. Invalid UTR, Amount mismatch):', 'Invalid UTR');
    if (reason === null) return;

    try {
      await api.adminRejectPayment(adminToken, paymentId, reason);
      showNotice('Payment rejected and seat released.', 'info');
      loadAdminDashboard();
      loadEventDetails();
    } catch (err) {
      showNotice(err.message || 'Could not reject payment', 'error');
    }
  }

  async function handleCancelTicket(ticketId) {
    if (!confirm('Are you sure you want to cancel this confirmed ticket? The seat will be released.')) return;
    try {
      await api.adminCancelTicket(adminToken, ticketId, 'Admin cancelled');
      showNotice('Ticket cancelled and seat released.', 'info');
      loadAdminDashboard();
      loadEventDetails();
    } catch (err) {
      showNotice(err.message || 'Could not cancel ticket', 'error');
    }
  }

  async function handleExportCsv() {
    try {
      const blob = await api.adminExportCsv(adminToken);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Alfaaz-Attendees.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showNotice(err.message || 'Failed to export CSV', 'error');
    }
  }

  // Filtered admin bookings
  const filteredBookings = adminBookings.filter(b => {
    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase();
      const match =
        b.fullName.toLowerCase().includes(q) ||
        b.mobile.includes(q) ||
        b.bookingReference.toLowerCase().includes(q) ||
        (b.utrNumber && b.utrNumber.toLowerCase().includes(q)) ||
        (b.ticketNumber && b.ticketNumber.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (adminFilterCategory !== 'ALL' && b.ticketType !== adminFilterCategory) return false;
    if (adminFilterStatus !== 'ALL' && b.status !== adminFilterStatus) return false;
    return true;
  });

  const pendingPaymentsList = adminBookings.filter(b => b.paymentStatus === 'SUBMITTED' || (b.status === 'PENDING' && b.utrNumber));

  return (
    <div className="alfaaz-app">
      {/* GLOBAL TOAST NOTICE */}
      {notice && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: notice.type === 'error' ? '#991b1b' : notice.type === 'success' ? '#166534' : '#4a1521',
          color: '#ffffff',
          padding: '12px 22px',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          {notice.msg}
        </div>
      )}

      {/* HEADER: Minimalist, elegant sticky navigation */}
      <header className="site-header">
        <div className="header-inner">
          <div className="brand-wrap" onClick={() => { setPage('home'); window.scrollTo(0, 0); }}>
            <span className="brand-monogram">ALFAAZ</span>
            <span className="brand-dot">✦</span>
          </div>
          <nav className="nav-links">
            <button className={`nav-btn ${page === 'home' ? 'active' : ''}`} onClick={() => { setPage('home'); window.scrollTo(0, 0); }}>Event</button>
            <button className={`nav-btn ${page === 'myticket' ? 'active' : ''}`} onClick={() => { setPage('myticket'); window.scrollTo(0, 0); }}>Find My Ticket</button>
            <button className={`nav-btn ${page === 'admin' ? 'active' : ''}`} onClick={() => { setPage('admin'); window.scrollTo(0, 0); }}>Admin Login</button>
            <button className="nav-cta" onClick={() => { setPage('book'); window.scrollTo(0, 0); }}>Book Pass · ₹100</button>
          </nav>
        </div>
      </header>

      <main>
        {/* ================= PAGE 1: LANDING PAGE ================= */}
        {page === 'home' && (
          <div>
            {/* HERO SECTION */}
            <section className="hero-section">
              <div className="hero-ambient-glow"></div>
              <div className="hero-inner">
                {/* 1. Small Stylish Date Badge */}
                <div className="hero-badge">
                  <span className="badge-spark">✦</span>
                  9 NOV 2026 · BASMAT
                </div>

                {/* 2. Headline */}
                <h1 className="hero-title">
                  Your Voice. <em>Your Moment.</em>
                </h1>

                {/* 3. Essential Event Details in Compact Line */}
                <div className="hero-compact-meta">
                  <span className="meta-icon">📍</span>
                  <span>9 November 2026 · 5:00 PM onwards · Beyond Temptation, Basmat</span>
                </div>

                {/* 4. Short Tagline */}
                <p className="hero-tagline">
                  An intimate open mic gathering of raw poetry, acoustic chords &amp; unscripted stories.
                </p>

                {/* 5. Two Prominent Buttons */}
                <div className="hero-action-group">
                  <button
                    className="btn-primary"
                    disabled={event.availableSeats <= 0}
                    onClick={() => { setPage('book'); window.scrollTo(0, 0); }}
                  >
                    <span>Book Your Pass · ₹100</span>
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => { setPage('myticket'); window.scrollTo(0, 0); }}
                  >
                    <span>Find My Ticket</span>
                  </button>
                </div>

                {/* 6. Artistic Visual Element: Vintage Microphone & Acoustic Spotlight */}
                <div className="hero-artistic-visual">
                  <div className="spotlight-cone"></div>
                  <svg className="vintage-mic-svg" viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Concentric sound wave ripples */}
                    <circle cx="110" cy="72" r="50" stroke="rgba(199, 165, 106, 0.25)" strokeWidth="1" strokeDasharray="3 3"/>
                    <circle cx="110" cy="72" r="70" stroke="rgba(197, 58, 80, 0.2)" strokeWidth="1"/>
                    <circle cx="110" cy="72" r="92" stroke="rgba(199, 165, 106, 0.12)" strokeWidth="1" strokeDasharray="4 4"/>

                    {/* Microphone capsule */}
                    <rect x="88" y="26" width="44" height="68" rx="22" fill="#4A1422" stroke="#C7A56A" strokeWidth="2.4"/>
                    {/* Grille ribs */}
                    <line x1="91" y1="46" x2="129" y2="46" stroke="#FAF5EB" strokeWidth="1.2" strokeOpacity="0.45"/>
                    <line x1="90" y1="58" x2="130" y2="58" stroke="#C7A56A" strokeWidth="1.8"/>
                    <line x1="91" y1="70" x2="129" y2="70" stroke="#FAF5EB" strokeWidth="1.2" strokeOpacity="0.45"/>
                    <line x1="110" y1="28" x2="110" y2="92" stroke="#C7A56A" strokeWidth="1.8"/>

                    {/* Neck pivot joint */}
                    <rect x="99" y="96" width="22" height="12" rx="2" fill="#C53A50" stroke="#C7A56A" strokeWidth="1.2"/>

                    {/* Mechanical yoke / mount */}
                    <path d="M 78 72 L 78 108 C 78 126 142 126 142 108 L 142 72" stroke="#C7A56A" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                    <circle cx="78" cy="72" r="4" fill="#C7A56A"/>
                    <circle cx="142" cy="72" r="4" fill="#C7A56A"/>

                    {/* Stand rod */}
                    <rect x="107" y="122" width="6" height="56" fill="#4A1422" stroke="#C7A56A" strokeWidth="1.2"/>

                    {/* Weighted base */}
                    <ellipse cx="110" cy="182" rx="42" ry="9" fill="#4A1422" stroke="#C7A56A" strokeWidth="2.2"/>
                    <ellipse cx="110" cy="180" rx="26" ry="5.5" fill="#C53A50" fillOpacity="0.5"/>
                  </svg>
                </div>
              </div>
            </section>

            {/* WHAT'S ON STAGE (Editorial Grid) */}
            <section className="section">
              <div className="section-head">
                <div className="section-eyebrow">WHAT'S ON STAGE</div>
                <h2 className="section-title">Poetry, Chords &amp; Stories</h2>
                <p className="section-subtitle">
                  An uncensored room for raw emotion, melody, and spontaneous laughter.
                </p>
              </div>

              <div className="genres-grid">
                <div className="genre-card">
                  <div className="genre-num">01</div>
                  <h3>Poetry &amp; Shayari</h3>
                  <p>Ghazals, nazms, free verse or spoken word. Bring your handwritten pages to an attentive listening room.</p>
                </div>
                <div className="genre-card">
                  <div className="genre-num">02</div>
                  <h3>Acoustic Music</h3>
                  <p>Unplugged vocals, guitar chords, or original melodies that resonate up close in an intimate café setting.</p>
                </div>
                <div className="genre-card">
                  <div className="genre-num">03</div>
                  <h3>Stand-Up Comedy</h3>
                  <p>Relatable observations, sharp punchlines, and candid laughter shared face-to-face with friends.</p>
                </div>
                <div className="genre-card">
                  <div className="genre-num">04</div>
                  <h3>Real Stories</h3>
                  <p>Personal memories, confessions, travel tales, or untold moments spoken straight from the heart.</p>
                </div>
              </div>
            </section>

            {/* UNIFIED PASS SECTION */}
            <section className="section pass-section-wrap">
              <div className="section-head">
                <div className="section-eyebrow">SINGLE RESERVED PASS</div>
                <h2 className="section-title">Alfaaz Event Pass · ₹100</h2>
                <p className="section-subtitle">
                  Strictly capped at 40 seats. Audience chair or 5–7 min stage slot included.
                </p>
              </div>

              <div className="single-pass-wrap">
                <div className="single-pass-card">
                  <div className="pass-top-bar">
                    <span className="pass-badge-pill">LIMITED TO 40 ATTENDEES</span>
                    <span className="pass-date-tag">9 NOV 2026 · 5 PM</span>
                  </div>

                  <div className="pass-title-row">
                    <div>
                      <h3 className="single-pass-title">Alfaaz Entry Pass</h3>
                      <p className="single-pass-desc">Beyond Temptation, Ashegaon Road, Basmat</p>
                    </div>
                    <div className="single-pass-price">
                      <span className="currency">₹</span>100
                      <small>flat fee per person</small>
                    </div>
                  </div>

                  <div className="pass-perks-grid">
                    <div className="pass-perk-item">
                      <span className="perk-bullet">✦</span>
                      <div>
                        <strong>Guaranteed Reserved Chair</strong>
                        <p>Comfortable seated arrangement inside Beyond Temptation café.</p>
                      </div>
                    </div>
                    <div className="pass-perk-item">
                      <span className="perk-bullet">✦</span>
                      <div>
                        <strong>Open to Audience &amp; Performers</strong>
                        <p>Sit back and listen, or register a 5–7 min stage performance slot.</p>
                      </div>
                    </div>
                    <div className="pass-perk-item">
                      <span className="perk-bullet">✦</span>
                      <div>
                        <strong>Full Evening Program</strong>
                        <p>Access to all poetry, acoustic melodies, storytelling, and comedy sets.</p>
                      </div>
                    </div>
                    <div className="pass-perk-item">
                      <span className="perk-bullet">✦</span>
                      <div>
                        <strong>Digital QR Entry Pass</strong>
                        <p>Instant PDF ticket and unique cryptographic QR code for seamless door entry.</p>
                      </div>
                    </div>
                  </div>

                  <div className="single-pass-cta-wrap">
                    <button
                      className="btn-primary btn-large"
                      disabled={event.availableSeats <= 0}
                      onClick={() => { setPage('book'); window.scrollTo(0, 0); }}
                    >
                      <span>Book Your Pass · ₹100</span>
                    </button>
                    <div className="pass-guarantee-note">
                      Direct UPI Payment · Instant entry QR on verification
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* HOW IT WORKS (Concise 3-Step Flow) */}
            <section className="section">
              <div className="section-head">
                <div className="section-eyebrow">THE EXPERIENCE</div>
                <h2 className="section-title">How It Works</h2>
                <p className="section-subtitle">Book your pass in under a minute with zero confusion.</p>
              </div>

              <div className="steps-grid">
                <div className="step-card">
                  <div className="step-num">01</div>
                  <h4>Enter Details</h4>
                  <p>Provide your name and 10-digit mobile number. Select if you're taking the open mic stage.</p>
                </div>
                <div className="step-card">
                  <div className="step-num">02</div>
                  <h4>Scan &amp; Pay ₹100</h4>
                  <p>Scan with GPay, PhonePe, or Paytm and submit your 12-digit transaction UTR number.</p>
                </div>
                <div className="step-card">
                  <div className="step-num">03</div>
                  <h4>Instant QR Entry</h4>
                  <p>Show your verified QR pass at Beyond Temptation on 9 Nov for seamless gate entry.</p>
                </div>
              </div>
            </section>

            {/* VENUE & CONTACT */}
            <section className="section">
              <div className="venue-banner">
                <div className="venue-info-main">
                  <div className="venue-tag">EVENT LOCATION</div>
                  <h3>Beyond Temptation</h3>
                  <p>
                    Ashegaon Road, Basmat — An intimate café space with warm ambient lighting, handcrafted brews, and an acoustic stage.
                  </p>
                </div>
                <div className="venue-meta">
                  <div className="venue-meta-row">
                    <span className="venue-icon">📅</span>
                    <div>
                      <div className="meta-sub">Date &amp; Time</div>
                      <strong>Monday, 9 Nov 2026 · 5:00 PM</strong>
                    </div>
                  </div>
                  <div className="venue-meta-row">
                    <span className="venue-icon">📍</span>
                    <div>
                      <div className="meta-sub">Venue Address</div>
                      <strong>Beyond Temptation, Basmat</strong>
                    </div>
                  </div>
                  <div className="venue-meta-row">
                    <span className="venue-icon">📞</span>
                    <div>
                      <div className="meta-sub">For Help Contact</div>
                      <strong><a href="tel:8624890246" style={{ color: 'inherit', textDecoration: 'none' }}>+91 8624890246</a></strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ================= PAGE 2: BOOKING FORM ================= */}
        {page === 'book' && (
          <div className="section" style={{ maxWidth: '620px' }}>
            <div className="modal-head">
              <div className="section-eyebrow">Reservation Desk</div>
              <h2>Book Your Alfaaz Pass</h2>
              <p>Enter your name and mobile number to reserve your chair.</p>
            </div>

            <form onSubmit={handleReserveSeat} style={{ background: '#fff', padding: '32px 28px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-300)', boxShadow: 'var(--shadow-md)' }}>
              {/* Pass Header summary */}
              <div style={{ background: 'var(--cream-100)', padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--cream-300)', marginBottom: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '16px', color: 'var(--maroon-900)' }}>Alfaaz Entry Pass</strong>
                  <span style={{ fontSize: '12.5px', color: 'var(--charcoal-600)' }}>1 Reserved Chair · 9 Nov 2026, 5:00 PM</span>
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', fontWeight: 800, color: 'var(--maroon-900)' }}>
                  ₹100
                </div>
              </div>

              {/* Personal Details */}
              <div className="form-group">
                <label>Full Name <span className="req">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nishant Patil"
                  className="form-input"
                  value={bookingForm.fullName}
                  onChange={e => setBookingForm({ ...bookingForm, fullName: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Mobile Number (For Ticket Lookup & Entry) <span className="req">*</span></label>
                <input
                  type="tel"
                  required
                  maxLength={12}
                  placeholder="10-digit mobile number"
                  className="form-input"
                  value={bookingForm.mobile}
                  onChange={e => setBookingForm({ ...bookingForm, mobile: e.target.value })}
                />
                <small style={{ color: 'var(--charcoal-600)', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                  💡 You can reopen your confirmed ticket anytime using this mobile number.
                </small>
              </div>

              {/* Simple Performer Question */}
              <div style={{ background: 'var(--cream-50)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--cream-300)', marginBottom: '22px' }}>
                <label style={{ fontWeight: 700, display: 'block', marginBottom: '10px', color: 'var(--maroon-900)' }}>
                  Will you be performing on the open mic stage?
                </label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="isPerformer"
                      checked={!bookingForm.isPerformer}
                      onChange={() => setBookingForm({ ...bookingForm, isPerformer: false })}
                    />
                    No, attending as Audience
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                    <input
                      type="radio"
                      name="isPerformer"
                      checked={bookingForm.isPerformer}
                      onChange={() => setBookingForm({ ...bookingForm, isPerformer: true })}
                    />
                    Yes, I want to perform!
                  </label>
                </div>

                {/* Performer Details (shown only if Yes) */}
                {bookingForm.isPerformer && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--cream-300)' }}>
                    <div className="form-group">
                      <label>Performance Category <span className="req">*</span></label>
                      <select
                        className="form-select"
                        value={bookingForm.performerCategory}
                        onChange={e => setBookingForm({ ...bookingForm, performerCategory: e.target.value })}
                      >
                        <option value="Poetry">Poetry / Shayari / Nazm</option>
                        <option value="Music">Acoustic Music / Singing</option>
                        <option value="Comedy">Stand-Up Comedy</option>
                        <option value="Storytelling">Storytelling / Dastangoi</option>
                        <option value="Other">Other Performance</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Performance Title / Description (Optional)</label>
                      <textarea
                        placeholder="Briefly describe what you'll present, language (Hindi/Marathi/Urdu/English), etc."
                        className="form-textarea"
                        value={bookingForm.performanceDescription}
                        onChange={e => setBookingForm({ ...bookingForm, performanceDescription: e.target.value })}
                      ></textarea>
                    </div>
                  </div>
                )}
              </div>

              {/* Price Summary */}
              <div className="price-summary-box">
                <div>
                  <div className="title">Alfaaz Pass · {bookingForm.isPerformer ? 'Performer Slot Included' : 'Audience Seated'}</div>
                  <small style={{ color: 'var(--charcoal-600)' }}>Beyond Temptation, Basmat · 9 Nov 2026, 5 PM</small>
                </div>
                <div className="total">
                  ₹100
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={isReserving}
              >
                {isReserving ? 'Reserving Seat...' : 'Proceed to UPI Payment (₹100) →'}
              </button>

              <button
                type="button"
                className="btn-secondary"
                style={{ width: '100%', marginTop: '10px' }}
                onClick={() => setPage('home')}
              >
                Cancel & Return
              </button>
            </form>
          </div>
        )}

        {/* ================= PAGE 3: UPI PAYMENT & UTR SUBMISSION ================= */}
        {page === 'payment' && bookingReserve && (
          <div className="section" style={{ maxWidth: '640px' }}>
            <div className="payment-screen" style={{ background: '#fff', padding: '36px 30px', borderRadius: 'var(--radius-lg)', border: '2px solid var(--maroon-700)', boxShadow: 'var(--shadow-warm)' }}>
              <div className="timer-pill">
                ⏱️ Seat Reserved · Awaiting UPI Payment
              </div>

              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '26px', color: 'var(--maroon-900)', marginBottom: '6px' }}>
                Scan UPI QR to Complete Payment
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--charcoal-600)', marginBottom: '20px' }}>
                Payable Amount: <strong style={{ color: 'var(--red-accent)', fontSize: '20px' }}>₹100</strong>
              </p>

              {/* QR Image Display */}
              <div className="qr-display-frame">
                <img
                  src="/upi-qr.png"
                  onError={(e) => { e.target.onerror = null; e.target.src = '/upi-qr.svg'; }}
                  alt="Alfaaz UPI QR Code"
                />
              </div>

              {/* UPI ID Strip with 8624890246@ibl */}
              <div className="upi-details-strip">
                <span>{bookingReserve.upiId || '8624890246@ibl'}</span>
                <button
                  className="btn-copy"
                  onClick={() => {
                    const upi = bookingReserve.upiId || '8624890246@ibl';
                    navigator.clipboard.writeText(upi);
                    showNotice('UPI ID copied: ' + upi, 'info');
                  }}
                >
                  Copy UPI ID
                </button>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--charcoal-600)', marginBottom: '24px' }}>
                For Help Contact: <strong>+91 8624890246</strong>
              </div>

              {/* UTR Submission Form */}
              {!isPaymentSubmitted ? (
                <form onSubmit={handleSubmitUtr} style={{ textAlign: 'left', background: 'var(--cream-100)', padding: '22px', borderRadius: 'var(--radius-md)', border: '1px solid var(--cream-300)' }}>
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label style={{ fontWeight: 700 }}>
                      Enter 12-Digit UPI Reference / UTR Number <span className="req">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 431289104523"
                      className="form-input"
                      value={utrNumber}
                      onChange={e => setUtrNumber(e.target.value)}
                    />
                    <small style={{ color: 'var(--charcoal-600)', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                      Check your GPay / PhonePe / Paytm receipt for the 12-digit UTR / UPI Ref ID.
                    </small>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    disabled={isSubmittingUtr}
                  >
                    {isSubmittingUtr ? 'Submitting Reference...' : 'Payment Completed · Submit UTR'}
                  </button>
                </form>
              ) : (
                <div style={{ background: '#fef3c7', border: '1.5px solid #d97706', padding: '22px', borderRadius: 'var(--radius-md)', color: '#78350f', textAlign: 'left' }}>
                  <h4 style={{ fontSize: '17px', fontWeight: 800, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⏳ Payment Submitted & Under Review
                  </h4>
                  <p style={{ fontSize: '14px', marginBottom: '12px', lineHeight: 1.5 }}>
                    We received your UTR: <strong>{utrNumber}</strong>. Our admin is verifying the transaction with our bank.
                  </p>
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '6px', border: '1px solid #fde68a', fontSize: '13px', color: '#92400e', marginBottom: '14px' }}>
                    ✨ <strong>Zero effort required:</strong> You don't need to copy any codes. This page will <strong>automatically open your confirmed ticket</strong> the moment the admin verifies!
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span className="dot" style={{ width: '9px', height: '9px', background: '#d97706', borderRadius: '50%', display: 'inline-block' }}></span>
                    Auto-checking verification status every few seconds...
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= PAGE 4: EVENT CONFIRMATION PAGE ================= */}
        {page === 'confirmation' && confirmedTicket && (
          <div className="confirmation-page">
            {/* Celebration Banner */}
            <div className="celebration-banner">
              <span className="sparkle">✨ 🎙️ ✨</span>
              <h2>Your ticket is confirmed! You're officially part of Alfaaz Open Mic.</h2>
              <p>
                Get ready for an extraordinary evening of words, music, and honest art. Your seat has been reserved.
              </p>
            </div>

            {/* Complete Ticket Stub */}
            <div className="ticket-pass">
              <div className="ticket-header-strip">
                <div>
                  <h3>ALFAAZ OPEN MIC</h3>
                  <small style={{ letterSpacing: '1px', opacity: 0.9 }}>YOUR VOICE · YOUR MOMENT · 2026</small>
                </div>
                <div className="pass-badge">
                  {confirmedTicket.ticketType.toUpperCase()} PASS (₹100)
                </div>
              </div>

              <div className="ticket-body">
                {/* Left column details */}
                <div className="ticket-details-col">
                  <div className="attendee-title">ATTENDEE NAME</div>
                  <div className="attendee-name">{confirmedTicket.attendeeName}</div>

                  <div className="ticket-meta-grid">
                    <div className="ticket-meta-item">
                      <div className="meta-label">Ticket ID</div>
                      <div className="meta-value">{confirmedTicket.ticketNumber}</div>
                    </div>
                    <div className="ticket-meta-item">
                      <div className="meta-label">Booking Reference</div>
                      <div className="meta-value">{confirmedTicket.bookingReference}</div>
                    </div>
                    <div className="ticket-meta-item">
                      <div className="meta-label">Mobile Number</div>
                      <div className="meta-value">{confirmedTicket.mobile}</div>
                    </div>
                    <div className="ticket-meta-item">
                      <div className="meta-label">Date & Time</div>
                      <div className="meta-value">9 Nov 2026 · 5:00 PM</div>
                    </div>
                    <div className="ticket-meta-item">
                      <div className="meta-label">Venue</div>
                      <div className="meta-value">Beyond Temptation, Basmat</div>
                    </div>
                    <div className="ticket-meta-item">
                      <div className="meta-label">Payment Status</div>
                      <div className="meta-value" style={{ color: 'var(--green-emerald)' }}>
                        ✓ {confirmedTicket.paymentStatus} (PAID ₹100)
                      </div>
                    </div>
                  </div>

                  {confirmedTicket.ticketType === 'Performer' && confirmedTicket.performerCategory && (
                    <div style={{ marginTop: '18px', padding: '12px', background: 'var(--cream-100)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--maroon-700)' }}>
                      <div className="meta-label">PERFORMANCE SPOTLIGHT</div>
                      <div style={{ fontWeight: 700, color: 'var(--maroon-900)' }}>
                        {confirmedTicket.performerCategory}
                        {confirmedTicket.performanceDescription ? ` — ${confirmedTicket.performanceDescription}` : ''}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right column: Unique Entry QR Code */}
                <div className="ticket-qr-col">
                  <div className="qr-image-wrap">
                    <img
                      src={qrDataUrl || (confirmedTicket.qrBase64 ? `data:image/png;base64,${confirmedTicket.qrBase64}` : `data:image/png;base64,${confirmedTicket.qrPngBase64}`)}
                      alt="Unique Entry QR Code"
                    />
                  </div>
                  <div className="qr-caption">UNIQUE ENTRY QR CODE</div>
                  <div className="status-tag">
                    {confirmedTicket.attended ? 'MARKED USED' : 'ENTRY VERIFIED'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--charcoal-400)', marginTop: '6px' }}>
                    Valid for single entry at venue
                  </div>
                </div>
              </div>
            </div>

            {/* 4 WORKING ACTION BUTTONS + WHATSAPP SHARE */}
            <div className="ticket-actions-bar">
              <button className="btn-action primary-action" onClick={downloadPdf}>
                <span>📄</span> Download Ticket as PDF
              </button>
              <button className="btn-action" onClick={downloadQrPng}>
                <span>🖼️</span> Download QR Code as PNG
              </button>
              <button className="btn-whatsapp" onClick={shareTicketOnWhatsApp}>
                <span>💬</span> Save to WhatsApp
              </button>
              <button className="btn-action" onClick={printTicket}>
                <span>🖨️</span> Print Ticket
              </button>
            </div>

            {/* REOPEN TICKET LATER CARD */}
            <div className="reopen-ticket-card">
              <h4>Permanent Access Link for Later</h4>
              <p>
                Bookmark this secure URL or simply enter your mobile number <strong>({confirmedTicket.mobile})</strong> on the "Find My Ticket" page anytime:
              </p>
              <div className="copy-link-group">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/?ticket=${confirmedTicket.accessKey}`}
                />
                <button className="btn-copy" onClick={copyTicketLink}>
                  {copiedLink ? 'Copied ✓' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= PAGE 5: FIND MY TICKET (VIA MOBILE NUMBER) ================= */}
        {page === 'myticket' && (
          <div className="section" style={{ maxWidth: '560px' }}>
            <div className="modal-head">
              <div className="section-eyebrow">Self Service</div>
              <h2>Find Your Ticket</h2>
              <p>Enter your 10-digit mobile number to pull up your confirmed ticket.</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleLookupBooking(); }} style={{ background: '#fff', padding: '32px 28px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-300)', boxShadow: 'var(--shadow-md)' }}>
              <div className="form-group">
                <label style={{ fontWeight: 700, color: 'var(--maroon-900)' }}>
                  Mobile Number or Booking Reference
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 8624890246 or ALF-2026-XXXX"
                  className="form-input"
                  value={lookupQuery}
                  onChange={e => setLookupQuery(e.target.value)}
                />
                <small style={{ color: 'var(--charcoal-600)', fontSize: '12.5px', display: 'block', marginTop: '6px' }}>
                  📱 No need to remember booking codes! Just type the phone number you used while booking.
                </small>
              </div>

              {lookupError && (
                <div style={{ color: '#dc2626', background: '#fef2f2', padding: '12px', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '13px', marginBottom: '16px', fontWeight: 600 }}>
                  {lookupError}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={lookupLoading}
              >
                {lookupLoading ? 'Searching...' : 'Find My Ticket →'}
              </button>
            </form>
          </div>
        )}

        {/* ================= PAGE 6: ADMIN DASHBOARD (INCLUDES DOOR QR SCANNER) ================= */}
        {page === 'admin' && (
          <div className="admin-container">
            {!adminToken ? (
              // Admin Login Card
              <div style={{ maxWidth: '440px', margin: '40px auto', background: '#fff', padding: '34px', borderRadius: 'var(--radius-lg)', border: '2px solid var(--maroon-700)', boxShadow: 'var(--shadow-warm)' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div className="brand-icon" style={{ margin: '0 auto 12px' }}>A</div>
                  <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--maroon-900)' }}>Alfaaz Admin Portal</h2>
                  <p style={{ fontSize: '13px', color: 'var(--charcoal-600)' }}>Sign in to verify payments and manage door QR scanner</p>
                </div>

                <form onSubmit={handleAdminLogin}>
                  <div className="form-group">
                    <label>Admin Username</label>
                    <input
                      type="text"
                      required
                      placeholder="admin"
                      className="form-input"
                      value={adminUsername}
                      onChange={e => setAdminUsername(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Admin Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      className="form-input"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                    />
                  </div>

                  {adminLoginError && (
                    <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '14px', fontWeight: 600 }}>
                      {adminLoginError}
                    </div>
                  )}

                  <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    Sign In to Dashboard →
                  </button>
                </form>
              </div>
            ) : (
              // Admin Main Management Dashboard
              <div>
                <div className="admin-header">
                  <div className="admin-title-wrap">
                    <h2>Alfaaz Open Mic — Admin Command</h2>
                    <p style={{ fontSize: '13px', color: 'var(--charcoal-600)' }}>Real-time 40-Seat Capacity & Payment Verification</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button className="btn-secondary" onClick={handleExportCsv}>
                      📥 Export CSV
                    </button>
                    <button className="btn-secondary" onClick={() => loadAdminDashboard()}>
                      🔄 Refresh
                    </button>
                    <button className="btn-secondary" style={{ color: '#dc2626' }} onClick={handleAdminLogout}>
                      Logout
                    </button>
                  </div>
                </div>

                {/* Dashboard Stats Cards */}
                {adminStats && (
                  <div className="admin-stats-grid">
                    <div className="admin-stat-card">
                      <div className="stat-label">Maximum Capacity</div>
                      <div className="stat-val">{adminStats.totalCapacity}</div>
                    </div>
                    <div className="admin-stat-card">
                      <div className="stat-label">Confirmed Seats</div>
                      <div className="stat-val">{adminStats.confirmedBookings}</div>
                    </div>
                    <div className="admin-stat-card">
                      <div className="stat-label">Remaining Chairs</div>
                      <div className="stat-val">{adminStats.remainingSeats}</div>
                    </div>
                    <div className="admin-stat-card alert-card">
                      <div className="stat-label">Pending UTR Reviews</div>
                      <div className="stat-val">{adminStats.submittedPayments}</div>
                    </div>
                    <div className="admin-stat-card">
                      <div className="stat-label">Audience Bookings</div>
                      <div className="stat-val">{adminStats.audienceBookings}</div>
                    </div>
                    <div className="admin-stat-card">
                      <div className="stat-label">Performer Bookings</div>
                      <div className="stat-val">{adminStats.performerBookings}</div>
                    </div>
                    <div className="admin-stat-card">
                      <div className="stat-label">Door Checked-In</div>
                      <div className="stat-val">{adminStats.checkedInAttendees}</div>
                    </div>
                  </div>
                )}

                {/* Navigation Tabs (includes Gate QR Scanner) */}
                <div className="admin-tabs">
                  <button
                    className={`admin-tab-btn ${adminTab === 'payments' ? 'active' : ''}`}
                    onClick={() => setAdminTab('payments')}
                  >
                    Payment Verification Queue ({pendingPaymentsList.length})
                  </button>
                  <button
                    className={`admin-tab-btn ${adminTab === 'bookings' ? 'active' : ''}`}
                    onClick={() => setAdminTab('bookings')}
                  >
                    All Bookings & Tickets ({adminBookings.length})
                  </button>
                  <button
                    className={`admin-tab-btn ${adminTab === 'scanner' ? 'active' : ''}`}
                    onClick={() => setAdminTab('scanner')}
                  >
                    📷 Door QR Scanner
                  </button>
                  <button
                    className={`admin-tab-btn ${adminTab === 'attendance' ? 'active' : ''}`}
                    onClick={() => setAdminTab('attendance')}
                  >
                    Door Attendance List
                  </button>
                </div>

                {/* TAB 1: Payment Verification Queue */}
                {adminTab === 'payments' && (
                  <div>
                    {pendingPaymentsList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: 'var(--radius-md)' }}>
                        <p style={{ color: 'var(--charcoal-600)', fontSize: '15px' }}>✓ All submitted payments have been verified! No pending reviews.</p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Ref / UTR</th>
                              <th>Attendee Name</th>
                              <th>Mobile</th>
                              <th>Pass Category</th>
                              <th>Amount</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingPaymentsList.map(b => (
                              <tr key={b.id}>
                                <td>
                                  <strong>{b.bookingReference}</strong>
                                  <div style={{ fontFamily: 'monospace', color: 'var(--maroon-700)', fontWeight: 700 }}>
                                    UTR: {b.utrNumber || 'Not submitted'}
                                  </div>
                                </td>
                                <td>
                                  <strong>{b.fullName}</strong>
                                  {b.performerCategory && (
                                    <div style={{ fontSize: '12px', color: 'var(--charcoal-600)' }}>
                                      {b.performerCategory}: {b.performanceDescription}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <div>{b.mobile}</div>
                                </td>
                                <td>{b.ticketType}</td>
                                <td><strong>₹{b.amount}</strong></td>
                                <td>
                                  <span className="status-pill submitted">{b.paymentStatus}</span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      className="btn-action primary-action"
                                      style={{ padding: '6px 12px', fontSize: '12px' }}
                                      onClick={() => handleApprovePayment(b.id)}
                                    >
                                      ✓ Approve & Issue
                                    </button>
                                    <button
                                      className="btn-action"
                                      style={{ padding: '6px 12px', fontSize: '12px', color: '#dc2626' }}
                                      onClick={() => handleRejectPayment(b.id)}
                                    >
                                      ✕ Reject
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: All Bookings & Tickets */}
                {adminTab === 'bookings' && (
                  <div>
                    {/* Search and Filters */}
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
                      <input
                        type="text"
                        placeholder="Search by name, phone, ref, UTR, ticket ID..."
                        className="form-input"
                        style={{ maxWidth: '340px' }}
                        value={adminSearch}
                        onChange={e => setAdminSearch(e.target.value)}
                      />
                      <select
                        className="form-select"
                        style={{ maxWidth: '180px' }}
                        value={adminFilterCategory}
                        onChange={e => setAdminFilterCategory(e.target.value)}
                      >
                        <option value="ALL">All Categories</option>
                        <option value="Audience">Audience</option>
                        <option value="Performer">Performer</option>
                      </select>
                      <select
                        className="form-select"
                        style={{ maxWidth: '180px' }}
                        value={adminFilterStatus}
                        onChange={e => setAdminFilterStatus(e.target.value)}
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="PENDING">Pending</option>
                        <option value="SUBMITTED">Submitted</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>

                    <div className="table-responsive">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Ticket / Ref</th>
                            <th>Attendee</th>
                            <th>Mobile</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>UTR Number</th>
                            <th>Status</th>
                            <th>Attended</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBookings.map(b => (
                            <tr key={b.id}>
                              <td>
                                <strong>{b.ticketNumber || '—'}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--charcoal-400)' }}>{b.bookingReference}</div>
                              </td>
                              <td>
                                <strong>{b.fullName}</strong>
                                {b.performerCategory && (
                                  <div style={{ fontSize: '11px', color: 'var(--charcoal-600)' }}>
                                    {b.performerCategory}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div>{b.mobile}</div>
                              </td>
                              <td>{b.ticketType}</td>
                              <td>₹{b.amount}</td>
                              <td><code>{b.utrNumber || '—'}</code></td>
                              <td>
                                <span className={`status-pill ${b.status.toLowerCase()}`}>
                                  {b.status}
                                </span>
                              </td>
                              <td>
                                {b.attended ? (
                                  <span style={{ color: 'var(--green-emerald)', fontWeight: 800 }}>✓ YES</span>
                                ) : (
                                  <span style={{ color: 'var(--charcoal-400)' }}>No</span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  {b.status === 'CONFIRMED' && (
                                    <>
                                      <button
                                        className="btn-action"
                                        style={{ padding: '4px 10px', fontSize: '11px' }}
                                        onClick={() => loadTicketByAccessKey(b.accessKey)}
                                      >
                                        View Ticket
                                      </button>
                                      <button
                                        className="btn-action"
                                        style={{ padding: '4px 10px', fontSize: '11px', color: '#dc2626' }}
                                        onClick={() => handleCancelTicket(b.id)}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  )}
                                  {b.status !== 'CONFIRMED' && b.utrNumber && (
                                    <button
                                      className="btn-action primary-action"
                                      style={{ padding: '4px 10px', fontSize: '11px' }}
                                      onClick={() => handleApprovePayment(b.id)}
                                    >
                                      Approve
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 3: Door Camera Scanner (Admin Only) */}
                {adminTab === 'scanner' && (
                  <div className="scanner-wrapper" style={{ margin: '0 auto', maxWidth: '580px' }}>
                    <div className="scanner-panel">
                      <div className="section-eyebrow">Entry Verification</div>
                      <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--maroon-900)', fontSize: '22px', marginBottom: '6px' }}>
                        Admin Door Camera Scanner
                      </h3>
                      <p style={{ fontSize: '13px', color: 'var(--charcoal-600)', marginBottom: '16px' }}>
                        Point mobile camera at attendee's QR ticket. Single-entry database lock is enforced.
                      </p>

                      <div id="admin-qr-reader"></div>

                      {/* Live result banner */}
                      {scanResult && (
                        <div className={`scan-result-card ${scanResult.accepted ? 'approved' : scanResult.result === 'ALREADY_USED' ? 'already_used' : 'rejected'}`}>
                          <div className="scan-result-title">
                            {scanResult.accepted ? 'ENTRY APPROVED ✓' : scanResult.result === 'ALREADY_USED' ? 'ALREADY CHECKED IN' : scanResult.result}
                          </div>
                          {scanResult.attendeeName && (
                            <div className="scan-result-name">{scanResult.attendeeName}</div>
                          )}
                          {scanResult.ticketId && (
                            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>
                              Ticket #{scanResult.ticketId} · {scanResult.ticketType} Pass
                            </div>
                          )}
                          {scanResult.performerCategory && (
                            <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                              Genre: {scanResult.performerCategory}
                            </div>
                          )}
                          <p style={{ fontSize: '13px', marginTop: '6px' }}>
                            {scanResult.message}
                          </p>
                          <button
                            className="btn-primary"
                            style={{ marginTop: '16px', padding: '10px 24px', fontSize: '14px' }}
                            onClick={resumeScanning}
                          >
                            Scan Next Ticket →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 4: Door Attendance */}
                {adminTab === 'attendance' && (
                  <div>
                    <div className="table-responsive">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Ticket ID</th>
                            <th>Attendee</th>
                            <th>Category</th>
                            <th>Contact</th>
                            <th>Checked In</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminBookings
                            .filter(b => b.status === 'CONFIRMED')
                            .map(b => (
                              <tr key={b.id}>
                                <td><strong>{b.ticketNumber}</strong></td>
                                <td>{b.fullName}</td>
                                <td>{b.ticketType} {b.performerCategory ? `(${b.performerCategory})` : ''}</td>
                                <td>{b.mobile}</td>
                                <td>
                                  {b.attended ? (
                                    <span style={{ color: 'var(--green-emerald)', fontWeight: 800 }}>✓ Checked In</span>
                                  ) : (
                                    <span style={{ color: 'var(--charcoal-400)' }}>Not Arrived</span>
                                  )}
                                </td>
                                <td>
                                  <span className="status-pill verified">VALID TICKET</span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-brand">ALFAAZ OPEN MIC</div>
        <p>Your Voice. Your Moment. · 9 November 2026 at 5:00 PM</p>
        <p style={{ fontSize: '12.5px', color: 'var(--cream-300)' }}>
          Venue: Beyond Temptation, Ashegaon Road, Basmat · For Help Contact: <a href="tel:8624890246" style={{ color: 'inherit' }}>+91 8624890246</a> · UPI ID: 8624890246@ibl
        </p>
        <div className="copyright">
          © 2026 Alfaaz. Strictly capped at 40 seats. All rights reserved.
        </div>
      </footer>
    </div>
  );
}