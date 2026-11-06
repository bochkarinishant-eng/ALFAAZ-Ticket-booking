import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { fullName, mobile, email, ticketType, performerCategory, performanceDescription } = body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return new Response(JSON.stringify({ error: 'Full name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanMobile = (mobile || '').replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      return new Response(JSON.stringify({ error: 'Valid 10-digit mobile number is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();

    // 1. Clean expired reservations first
    await supabase.rpc('clean_expired_reservations');

    // 2. Fetch active event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: 'No active event found for bookings' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Check capacity
    const { count: confirmedCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .eq('status', 'CONFIRMED');

    const nowIso = new Date().toISOString();
    const { count: reservedCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .in('status', ['PENDING', 'SUBMITTED'])
      .gt('reserved_until', nowIso);

    const totalOccupied = (confirmedCount || 0) + (reservedCount || 0);
    if (totalOccupied >= event.max_capacity) {
      return new Response(
        JSON.stringify({
          error: `Sorry, Alfaaz Open Mic is FULL! All ${event.max_capacity} seats are booked or currently reserved.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Generate random reference & access key
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randCode = '';
    const randomBuffer = new Uint8Array(6);
    crypto.getRandomValues(randomBuffer);
    for (let i = 0; i < 6; i++) {
      randCode += chars[randomBuffer[i] % chars.length];
    }

    const bookingReference = `ALF-2026-${randCode}`;
    const accessKey = crypto.randomUUID().replace(/-/g, '');
    const reservedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const cleanTicketType = (ticketType || '').toLowerCase() === 'performer' ? 'Performer' : 'Audience';
    const amount = 100.0;

    // 5. Insert Booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        event_id: event.id,
        booking_reference: bookingReference,
        access_key: accessKey,
        full_name: fullName.trim(),
        mobile: cleanMobile,
        email: (email || '').trim().toLowerCase(),
        ticket_type: cleanTicketType,
        performer_category: cleanTicketType === 'Performer' ? (performerCategory || null) : null,
        performance_description: cleanTicketType === 'Performer' ? (performanceDescription || null) : null,
        quantity: 1,
        amount: amount,
        status: 'PENDING',
        reserved_until: reservedUntil,
      })
      .select()
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: bookingError?.message || 'Failed to create booking' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Insert initial payment record
    await supabase.from('payments').insert({
      booking_id: booking.id,
      amount: amount,
      currency: 'INR',
      payment_method: 'UPI',
      status: 'PENDING',
    });

    return new Response(
      JSON.stringify({
        bookingReference: booking.booking_reference,
        accessKey: booking.access_key,
        amount: booking.amount,
        ticketType: booking.ticket_type,
        reservedUntil: booking.reserved_until,
        upiId: event.upi_id,
        contactPhone: event.contact_phone,
        message: 'Seat temporarily reserved for 15 minutes. Please proceed with payment.',
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
