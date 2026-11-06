import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (SUPABASE_ANON_KEY) {
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  return headers;
}

export interface ActiveEvent {
  id: string | number;
  title: string;
  organizer: string;
  eventDateTime: string;
  venue: string;
  maxCapacity: number;
  confirmedSeats: number;
  reservedSeats: number;
  availableSeats: number;
  audiencePrice: number;
  performerPrice: number;
  contactPhone: string;
  upiId: string;
  active: boolean;
}

export interface BookingReserveResponse {
  bookingReference: string;
  accessKey: string;
  amount: number;
  ticketType: string;
  reservedUntil: string;
  upiId: string;
  contactPhone: string;
  message: string;
}

export interface BookingStatus {
  bookingReference: string;
  accessKey: string;
  fullName: string;
  mobile: string;
  email: string;
  ticketType: string;
  performerCategory?: string;
  performanceDescription?: string;
  amount: number;
  bookingStatus: string;
  paymentStatus: string;
  utrNumber?: string;
  ticketNumber?: string;
  reservedUntil: string;
}

export interface ConfirmedTicket {
  ticketNumber: string;
  bookingReference: string;
  accessKey: string;
  eventTitle: string;
  organizer: string;
  eventDateTime: string;
  venue: string;
  fullName: string;
  mobile: string;
  email: string;
  ticketType: string;
  performerCategory?: string;
  performanceDescription?: string;
  amount: number;
  paymentStatus: string;
  ticketStatus: string;
  attended: boolean;
  qrToken?: string;
  qrBase64?: string;
  createdAt: string;
  checkedInAt?: string;
}

export interface AdminStats {
  displayCapacity: number;
  confirmed: number;
  remaining: number;
  activeReservations: number;
  audience: number;
  performers: number;
  pending: number;
  submitted: number;
  verified: number;
  checkedIn: number;
}

export interface AdminBookingItem {
  id: string;
  paymentId?: string;
  ticketId?: string;
  bookingReference: string;
  accessKey: string;
  fullName: string;
  mobile: string;
  email: string;
  ticketType: string;
  performerCategory?: string;
  performanceDescription?: string;
  amount: number;
  status: string;
  paymentStatus: string;
  utrNumber?: string;
  ticketNumber?: string;
  attended: boolean;
  createdAt: string;
}

// 1. Get Active Event
export async function getActiveEvent(): Promise<ActiveEvent> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('get_active_event_summary');
      if (!error && data && !data.error) {
        return data as ActiveEvent;
      }
    } catch {
      // fallback to direct event query
      const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (event) {
        return {
          id: event.id,
          title: event.title,
          organizer: event.organizer,
          eventDateTime: event.event_date_time,
          venue: event.venue,
          maxCapacity: event.max_capacity,
          confirmedSeats: 0,
          reservedSeats: 0,
          availableSeats: event.max_capacity,
          audiencePrice: Number(event.audience_price),
          performerPrice: Number(event.performer_price),
          contactPhone: event.contact_phone,
          upiId: event.upi_id,
          active: event.active,
        };
      }
    }
  }

  // Fallback defaults
  return {
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
    active: true,
  };
}

// 2. Reserve Seat
export async function reserveSeat(params: {
  fullName: string;
  mobile: string;
  email?: string;
  ticketType: string;
  performerCategory?: string;
  performanceDescription?: string;
}): Promise<BookingReserveResponse> {
  const res = await fetch(`${FUNCTIONS_BASE}/create-booking`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reserve seat');
  return data;
}

// 3. Create Razorpay Payment Order
export async function createPaymentOrder(bookingReference: string) {
  const res = await fetch(`${FUNCTIONS_BASE}/create-payment-order`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ bookingReference }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create payment order');
  return data;
}

// 4. Verify Razorpay Payment Signature
export async function verifyPayment(params: {
  bookingReference: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const res = await fetch(`${FUNCTIONS_BASE}/verify-payment`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Payment signature verification failed');
  return data;
}

// 5. Submit Manual UPI Reference (UTR)
export async function submitPaymentUtr(bookingReference: string, utrNumber: string) {
  const res = await fetch(`${FUNCTIONS_BASE}/verify-payment`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ bookingReference, utrNumber }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to submit UPI reference');
  return data;
}

// 6. Get Booking Status
export async function getBookingStatus(query: string): Promise<BookingStatus> {
  const res = await fetch(`${FUNCTIONS_BASE}/get-booking?q=${encodeURIComponent(query)}`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Booking not found');
  return data;
}

// 7. Get Confirmed Ticket
export async function getConfirmedTicket(accessKey: string): Promise<ConfirmedTicket> {
  const res = await fetch(`${FUNCTIONS_BASE}/get-ticket?accessKey=${encodeURIComponent(accessKey)}`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ticket not found');
  return data;
}

// 8. Door Check-in
export async function checkInTicket(token: string) {
  const res = await fetch(`${FUNCTIONS_BASE}/validate-ticket`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Check-in validation failed');
  return data;
}

// 9. Admin Authentication
export async function adminLogin(emailOrUsername: string, password: string): Promise<{ token: string; user: any }> {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }

  // Support login either via email or username@alfaaz.local
  const email = emailOrUsername.includes('@')
    ? emailOrUsername
    : `${emailOrUsername.toLowerCase().trim()}@alfaaz.local`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw new Error(error?.message || 'Invalid credentials');
  }

  return {
    token: data.session.access_token,
    user: data.user,
  };
}

export async function adminLogout(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
}

// 10. Admin Stats
export async function getAdminStats(token: string): Promise<AdminStats> {
  const res = await fetch(`${FUNCTIONS_BASE}/admin-management?action=stats`, {
    headers: getHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch admin stats');
  return data;
}

// 11. Admin Bookings
export async function getAdminBookings(
  token: string,
  params?: { q?: string; category?: string; status?: string }
): Promise<AdminBookingItem[]> {
  const url = new URL(`${FUNCTIONS_BASE}/admin-management`);
  url.searchParams.set('action', 'bookings');
  if (params?.q) url.searchParams.set('q', params.q);
  if (params?.category) url.searchParams.set('category', params.category);
  if (params?.status) url.searchParams.set('status', params.status);

  const res = await fetch(url.toString(), {
    headers: getHeaders(token),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch bookings');
  return data;
}

// 12. Admin Approve Payment
export async function adminApprovePayment(token: string, paymentId: string) {
  const res = await fetch(`${FUNCTIONS_BASE}/admin-management?action=approve_payment`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ paymentId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to approve payment');
  return data;
}

// 13. Admin Reject Payment
export async function adminRejectPayment(token: string, paymentId: string, reason?: string) {
  const res = await fetch(`${FUNCTIONS_BASE}/admin-management?action=reject_payment`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ paymentId, reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reject payment');
  return data;
}

// 14. Admin Cancel Ticket
export async function adminCancelTicket(token: string, ticketId: string, reason?: string) {
  const res = await fetch(`${FUNCTIONS_BASE}/admin-management?action=cancel_ticket`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ ticketId, reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to cancel ticket');
  return data;
}

// 15. Admin Export CSV
export async function adminExportCsv(token: string): Promise<Blob> {
  const res = await fetch(`${FUNCTIONS_BASE}/admin-management?action=export_csv`, {
    headers: getHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to export CSV');
  return await res.blob();
}
