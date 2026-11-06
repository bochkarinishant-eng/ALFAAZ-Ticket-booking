import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('q') || url.searchParams.get('bookingRef') || '';

    if (!query.trim()) {
      return new Response(JSON.stringify({ error: 'Search query or booking reference is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clean = query.trim();
    const supabase = getServiceClient();

    // 1. Try finding by booking_reference
    let { data: booking } = await supabase
      .from('bookings')
      .select('*, payment:payments(*), ticket:tickets(*)')
      .eq('booking_reference', clean)
      .maybeSingle();

    // 2. Try finding by access_key
    if (!booking) {
      const res = await supabase
        .from('bookings')
        .select('*, payment:payments(*), ticket:tickets(*)')
        .eq('access_key', clean)
        .maybeSingle();
      booking = res.data;
    }

    // 3. Try finding by phone number (last 10 digits)
    if (!booking) {
      const digits = clean.replace(/\D/g, '');
      if (digits.length >= 10) {
        const last10 = digits.slice(-10);
        const res = await supabase
          .from('bookings')
          .select('*, payment:payments(*), ticket:tickets(*)')
          .ilike('mobile', `%${last10}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        booking = res.data;
      }
    }

    if (!booking) {
      return new Response(
        JSON.stringify({ error: `No booking found with this reference or mobile number: ${clean}` }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payment = Array.isArray(booking.payment) ? booking.payment[0] : booking.payment;
    const ticket = Array.isArray(booking.ticket) ? booking.ticket[0] : booking.ticket;

    return new Response(
      JSON.stringify({
        bookingReference: booking.booking_reference,
        accessKey: booking.access_key,
        fullName: booking.full_name,
        mobile: booking.mobile,
        email: booking.email,
        ticketType: booking.ticket_type,
        performerCategory: booking.performer_category,
        performanceDescription: booking.performance_description,
        amount: booking.amount,
        bookingStatus: booking.status,
        paymentStatus: payment?.status || 'PENDING',
        utrNumber: payment?.utr_number || null,
        ticketNumber: ticket?.ticket_number || null,
        reservedUntil: booking.reserved_until,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error?.message || 'Failed to retrieve booking' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
