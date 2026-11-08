import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://rvhiwnlshcdqqqqtwjfz.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_l_5th1aTpsN_2pWcf0-pwQ_wMh0vZJz';
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
  performanceStatus?: 'UPCOMING' | 'PERFORMING' | 'COMPLETED';
  ratingsEnabled?: boolean;
  totalRatings?: number;
  averageRating?: number;
  voteCount?: number;
  percentage?: number;
}

export interface PerformerRatingStat {
  id: string;
  name: string;
  category: string;
  description?: string;
  photoUrl?: string;
  displayOrder: number;
  performanceStatus: 'UPCOMING' | 'PERFORMING' | 'COMPLETED';
  ratingsEnabled: boolean;
  totalRatings: number;
  totalPoints: number;
  averageRating: number;
  rawAverage: number;
  star1: number;
  star2: number;
  star3: number;
  star4: number;
  star5: number;
}

export interface Top3Winner {
  id: string;
  name: string;
  category: string;
  photoUrl?: string;
  averageRating: number;
  totalRatings: number;
  rank: number;
}

export interface VotingResults {
  eventId: string;
  eventTitle: string;
  votingTitle: string;
  votingStatus: 'DRAFT' | 'OPEN' | 'CLOSED';
  resultsRevealed: boolean;
  winnersCalculated?: boolean;
  winnerAwards?: {
    first: string;
    second: string;
    third: string;
  };
  totalVotes?: number;
  totalRatings?: number;
  highestVotes?: number;
  isTie?: boolean;
  winnerCount?: number;
  performers: any[];
  top3Winners?: Top3Winner[];
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

// B. Fetch Public Active Performers (For Rating & Voting Page)
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
          performanceStatus: p.performance_status || 'COMPLETED',
          ratingsEnabled: p.ratings_enabled ?? true,
        }));
      }
    } catch {
      // Fallback
    }
  }

  // Default sample performers for demo / fallback
  return [
    { id: 'p1', name: 'Aarav Deshmukh', category: 'Poetry & Shayari', description: 'Spoken word piece on memories of Basmat and modern love.', isActive: true, displayOrder: 1, performanceStatus: 'COMPLETED', ratingsEnabled: true },
    { id: 'p2', name: 'Simran Kaur', category: 'Stand-up Comedy', description: 'Observational storytelling on small-town college life.', isActive: true, displayOrder: 2, performanceStatus: 'COMPLETED', ratingsEnabled: true },
    { id: 'p3', name: 'Rohan Patil', category: 'Acoustic Music', description: 'Original Hindi indie melody on acoustic guitar.', isActive: true, displayOrder: 3, performanceStatus: 'PERFORMING', ratingsEnabled: true },
    { id: 'p4', name: 'Pooja Sharma', category: 'Storytelling', description: 'Inspiring tale of discovering one’s voice through art.', isActive: true, displayOrder: 4, performanceStatus: 'UPCOMING', ratingsEnabled: false },
    { id: 'p5', name: 'Zaid Qureshi', category: 'Urdu Ghazal', description: 'Classical and contemporary Nazms with soulful delivery.', isActive: true, displayOrder: 5, performanceStatus: 'UPCOMING', ratingsEnabled: false },
  ];
}

// C. Local Storage helpers for tracking user submitted ratings per performer
export function getUserRatingsForEvent(eventId: string): Record<string, number> {
  const ratings: Record<string, number> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`alfaaz_rating_${eventId}_`)) {
        const perfId = key.replace(`alfaaz_rating_${eventId}_`, '');
        const val = parseInt(localStorage.getItem(key) || '0', 10);
        if (val >= 1 && val <= 5) {
          ratings[perfId] = val;
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  return ratings;
}

// D. Submit Performance Rating (1 to 5 Stars)
export async function submitPerformerRating(
  eventId: string,
  performerId: string,
  rating: number
): Promise<{ success: boolean; message: string; performer_name?: string; rating?: number }> {
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5 stars');
  }

  const tokenHash = await getVoterDeviceHash();

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('submit_performer_rating', {
      p_event_id: eventId,
      p_performer_id: performerId,
      p_voter_token_hash: tokenHash,
      p_rating: rating,
    });

    if (error) {
      throw new Error(error.message || 'Failed to submit rating');
    }

    if (data && !data.success) {
      throw new Error(data.error || 'Rating submission rejected');
    }

    localStorage.setItem(`alfaaz_rating_${eventId}_${performerId}`, rating.toString());
    return data;
  }

  localStorage.setItem(`alfaaz_rating_${eventId}_${performerId}`, rating.toString());
  return {
    success: true,
    message: 'Thank you! Your rating has been recorded.',
    rating: rating,
  };
}

// E. Backward-compatibility wrapper for single-vote calls
export async function submitAudienceVote(eventId: string, performerId: string): Promise<{ success: boolean; message: string; performerName?: string }> {
  return submitPerformerRating(eventId, performerId, 5);
}

// F. Fetch Admin Rating Results (Private Live Average Ratings & Top 3 Winners)
export async function getAdminRatingResults(token: string, eventId: string): Promise<VotingResults> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('get_admin_rating_results', {
      p_event_id: eventId,
    });

    if (!error && data && !data.error) {
      return data as VotingResults;
    }
  }

  return {
    eventId,
    eventTitle: 'Alfaaz Open Mic',
    votingTitle: 'Alfaaz Audience Performance Rating',
    votingStatus: 'OPEN',
    resultsRevealed: false,
    winnersCalculated: false,
    winnerAwards: {
      first: 'Alfaaz Star Performer',
      second: 'Alfaaz Outstanding Performer',
      third: 'Alfaaz Rising Performer'
    },
    totalRatings: 0,
    performers: [],
    top3Winners: [],
  };
}

export async function getVotingResults(token: string, eventId: string): Promise<VotingResults> {
  return getAdminRatingResults(token, eventId);
}

// G. Fetch Public Winners (Only accessible when admin reveals them)
export async function getPublicWinners(eventId: string): Promise<{ revealed: boolean; winners?: Top3Winner[]; winnerAwards?: { first: string; second: string; third: string }; message?: string }> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('get_public_winners', {
      p_event_id: eventId,
    });

    if (!error && data) {
      return data;
    }
  }

  return {
    revealed: false,
    message: 'Winners will be announced live on stage.',
  };
}

// H. Admin: Update Performer Stage Status & Rating Toggle
export async function adminUpdatePerformerStageStatus(
  token: string,
  performerId: string,
  status: 'UPCOMING' | 'PERFORMING' | 'COMPLETED',
  ratingsEnabled: boolean
) {
  // First try backend Edge Function (runs with service role to bypass RLS and auto-open event voting)
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/admin-management?action=update_performer_status`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ performerId, status, ratingsEnabled }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Edge function update_performer_status fallback:', err);
  }

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('performers')
      .update({
        performance_status: status,
        ratings_enabled: ratingsEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', performerId);

    if (error) throw new Error(error.message || 'Failed to update performer status');

    if (ratingsEnabled || status === 'PERFORMING' || status === 'COMPLETED') {
      await supabase
        .from('events')
        .update({ voting_status: 'OPEN' })
        .eq('active', true);
    }
    return { success: true };
  }
  return { success: true };
}

// I. Admin: Enable ratings for all completed performers at once
export async function adminEnableAllCompletedRatings(token: string, eventId: string) {
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/admin-management?action=enable_all_completed_ratings`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ eventId }),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Edge function enable_all_completed_ratings fallback:', err);
  }

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('performers')
      .update({
        ratings_enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
      .eq('performance_status', 'COMPLETED');

    if (error) throw new Error(error.message || 'Failed to enable ratings for completed performers');
    return { success: true };
  }
  return { success: true };
}

// J. Admin: Calculate Winners (Finalize rankings after closing voting)
export async function adminCalculateWinners(token: string, eventId: string) {
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/admin-management?action=calculate_winners`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ eventId }),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Edge function calculate_winners fallback:', err);
  }

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('events')
      .update({
        winners_calculated: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) throw new Error(error.message || 'Failed to finalize winner calculation');
    return { success: true };
  }
  return { success: true };
}

// K. Admin: Update Award Titles
export async function adminUpdateAwardTitles(
  token: string,
  eventId: string,
  first: string,
  second: string,
  third: string
) {
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/admin-management?action=update_award_titles`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ eventId, first, second, third }),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Edge function update_award_titles fallback:', err);
  }

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('events')
      .update({
        winner_award_1: first.trim(),
        winner_award_2: second.trim(),
        winner_award_3: third.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (error) throw new Error(error.message || 'Failed to update award titles');
    return { success: true };
  }
  return { success: true };
}

// L. Admin: Update Voting Status (Start / Close / Reveal)
export async function adminUpdateVotingStatus(
  token: string,
  eventId: string,
  status: 'DRAFT' | 'OPEN' | 'CLOSED',
  resultsRevealed: boolean
) {
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/admin-management?action=update_voting_status`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ eventId, status, resultsRevealed }),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Edge function update_voting_status fallback:', err);
  }

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

// M. Admin: Performer Management (Create, Update, Delete)
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
        performanceStatus: p.performance_status || 'UPCOMING',
        ratingsEnabled: p.ratings_enabled ?? false,
      }));
    }
  }
  return [];
}

export async function adminSavePerformer(
  token: string,
  performer: {
    id?: string;
    eventId: string;
    name: string;
    category: string;
    description?: string;
    photoUrl?: string;
    isActive: boolean;
    displayOrder?: number;
    performanceStatus?: 'UPCOMING' | 'PERFORMING' | 'COMPLETED';
    ratingsEnabled?: boolean;
  }
) {
  // First, attempt through admin-management Edge Function (bypasses RLS with service role)
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/admin-management?action=save_performer`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ performer }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Edge function save_performer fallback to direct client:', err);
  }

  if (isSupabaseConfigured && supabase) {
    const payload: any = {
      event_id: performer.eventId,
      name: performer.name.trim(),
      category: performer.category.trim(),
      description: performer.description?.trim() || null,
      photo_url: performer.photoUrl?.trim() || null,
      is_active: performer.isActive,
      display_order: performer.displayOrder || 0,
      performance_status: performer.performanceStatus || 'UPCOMING',
      ratings_enabled: performer.ratingsEnabled ?? false,
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
  // First, attempt through admin-management Edge Function
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/admin-management?action=delete_performer`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ performerId }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Edge function delete_performer fallback to direct client:', err);
  }

  if (isSupabaseConfigured && supabase) {
    const { count } = await supabase
      .from('performance_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('performer_id', performerId);

    if (count && count > 0) {
      const { error } = await supabase
        .from('performers')
        .update({ is_active: false })
        .eq('id', performerId);
      if (error) throw new Error(error.message);
      return { deactivated: true, message: 'Performer has recorded audience ratings; marked inactive to protect audit log.' };
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
