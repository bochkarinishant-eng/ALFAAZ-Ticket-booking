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
  votingStatus?: 'DRAFT' | 'OPEN' | 'CLOSED';
  votingTitle?: string;
  resultsRevealed?: boolean;
  totalVotes?: number;
  performerCount?: number;
}

export interface Performer {
  id: string;
  eventId?: string;
  name: string;
  category: string;
  description?: string;
  photoUrl?: string;
  isActive: boolean;
  displayOrder: number;
  voteCount?: number;
  percentage?: number;
}

export interface VotingResults {
  eventId: string;
  eventTitle: string;
  votingTitle: string;
  votingStatus: 'DRAFT' | 'OPEN' | 'CLOSED';
  resultsRevealed: boolean;
  totalVotes: number;
  highestVotes: number;
  isTie: boolean;
  winnerCount: number;
  performers: Performer[];
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

// 5. Submit UPI Reference (UTR)
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

// ============================================================================
// AUDIENCE CHOICE VOTING & PERFORMER MANAGEMENT
// ============================================================================

// A. Get Persistent Anonymous Voter Device Hash (Device-fingerprinted token)
export async function getVoterDeviceHash(): Promise<string> {
  let deviceId = localStorage.getItem('alfaaz_voter_device_id');
  if (!deviceId) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    deviceId = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('alfaaz_voter_device_id', deviceId);
  }

  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`alfaaz_voter_${deviceId}`));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

// B. Fetch Public Active Performers (For Voting Page)
export async function getActivePerformers(eventId?: string): Promise<Performer[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('performers')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (eventId) {
        query = query.eq('event_id', eventId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map((p: any) => ({
          id: p.id,
          eventId: p.event_id,
          name: p.name,
          category: p.category,
          description: p.description,
          photoUrl: p.photo_url,
          isActive: p.is_active,
          displayOrder: p.display_order,
        }));
      }
    } catch {
      // Fallback
    }
  }

  // Default sample performers for demo / fallback
  return [
    { id: 'p1', name: 'Aarav Deshmukh', category: 'Poetry & Shayari', description: 'Spoken word piece on memories of Basmat and modern love.', isActive: true, displayOrder: 1 },
    { id: 'p2', name: 'Simran Kaur', category: 'Stand-up Comedy', description: 'Observational storytelling on small-town college life.', isActive: true, displayOrder: 2 },
    { id: 'p3', name: 'Rohan Patil', category: 'Acoustic Music', description: 'Original Hindi indie melody on acoustic guitar.', isActive: true, displayOrder: 3 },
    { id: 'p4', name: 'Pooja Sharma', category: 'Storytelling', description: 'Inspiring tale of discovering one’s voice through art.', isActive: true, displayOrder: 4 },
    { id: 'p5', name: 'Zaid Qureshi', category: 'Urdu Ghazal', description: 'Classical and contemporary Nazms with soulful delivery.', isActive: true, displayOrder: 5 },
  ];
}

// C. Submit Anonymous Vote
export async function submitAudienceVote(eventId: string, performerId: string): Promise<{ success: boolean; message: string; performerName?: string }> {
  const tokenHash = await getVoterDeviceHash();

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('submit_vote', {
      p_event_id: eventId,
      p_performer_id: performerId,
      p_voter_token_hash: tokenHash,
    });

    if (error) {
      throw new Error(error.message || 'Failed to submit vote');
    }

    if (data && !data.success) {
      throw new Error(data.error || 'Vote submission rejected');
    }

    localStorage.setItem(`alfaaz_voted_${eventId}`, performerId);
    return data;
  }

  localStorage.setItem(`alfaaz_voted_${eventId}`, performerId);
  return {
    success: true,
    message: 'Your vote has been recorded! Thank you for supporting the artists of Alfaaz.',
  };
}

// D. Fetch Voting Results (Admin or when results are officially revealed)
export async function getVotingResults(token: string, eventId: string): Promise<VotingResults> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('get_voting_results', {
      p_event_id: eventId,
    });

    if (!error && data && !data.error) {
      return data as VotingResults;
    }
  }

  return {
    eventId,
    eventTitle: 'Alfaaz Open Mic',
    votingTitle: 'Alfaaz Audience Choice Award',
    votingStatus: 'OPEN',
    resultsRevealed: false,
    totalVotes: 0,
    highestVotes: 0,
    isTie: false,
    winnerCount: 0,
    performers: [],
  };
}

// E. Admin: Update Voting Status (Start / Close / Reveal)
export async function adminUpdateVotingStatus(
  token: string,
  eventId: string,
  status: 'DRAFT' | 'OPEN' | 'CLOSED',
  resultsRevealed: boolean
) {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('events')
      .update({
        voting_status: status,
        results_revealed: resultsRevealed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) throw new Error(error.message || 'Failed to update voting status');
    return { success: true };
  }
  return { success: true };
}

// F. Admin: Performer Management (Create, Update, Delete)
export async function adminGetPerformers(token: string, eventId: string): Promise<Performer[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('performers')
      .select('*')
      .eq('event_id', eventId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (!error && data) {
      return data.map((p: any) => ({
        id: p.id,
        eventId: p.event_id,
        name: p.name,
        category: p.category,
        description: p.description,
        photoUrl: p.photo_url,
        isActive: p.is_active,
        displayOrder: p.display_order,
      }));
    }
  }
  return [];
}

export async function adminSavePerformer(
  token: string,
  performer: { id?: string; eventId: string; name: string; category: string; description?: string; photoUrl?: string; isActive: boolean; displayOrder?: number }
) {
  if (isSupabaseConfigured && supabase) {
    const payload = {
      event_id: performer.eventId,
      name: performer.name.trim(),
      category: performer.category.trim(),
      description: performer.description?.trim() || null,
      photo_url: performer.photoUrl?.trim() || null,
      is_active: performer.isActive,
      display_order: performer.displayOrder || 0,
      updated_at: new Date().toISOString(),
    };

    if (performer.id) {
      const { data, error } = await supabase
        .from('performers')
        .update(payload)
        .eq('id', performer.id)
        .select()
        .single();
      if (error) throw new Error(error.message || 'Failed to update performer');
      return data;
    } else {
      const { data, error } = await supabase
        .from('performers')
        .insert(payload)
        .select()
        .single();
      if (error) throw new Error(error.message || 'Failed to create performer');
      return data;
    }
  }
  return { success: true };
}

export async function adminDeletePerformer(token: string, performerId: string) {
  if (isSupabaseConfigured && supabase) {
    const { count } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('performer_id', performerId);

    if (count && count > 0) {
      const { error } = await supabase
        .from('performers')
        .update({ is_active: false })
        .eq('id', performerId);
      if (error) throw new Error(error.message);
      return { deactivated: true, message: 'Performer has recorded votes; deactivated to protect historical audit trail.' };
    } else {
      const { error } = await supabase
        .from('performers')
        .delete()
        .eq('id', performerId);
      if (error) throw new Error(error.message);
      return { deleted: true, message: 'Performer deleted successfully.' };
    }
  }
  return { success: true };
}
