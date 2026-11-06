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
    const { bookingReference, utrNumber } = body;

    if (!bookingReference) {
      return new Response(JSON.stringify({ error: 'bookingReference is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanUtr = (utrNumber || '').trim();
    if (cleanUtr.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid UPI Reference / UTR Number (minimum 6 digits).' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = getServiceClient();

    // 1. Fetch booking with payment and event
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('*, event:events(*), payment:payments(*)')
      .eq('booking_reference', bookingReference.trim())
      .single();

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (booking.status === 'CONFIRMED') {
      return new Response(JSON.stringify({ error: 'Booking is already verified and confirmed.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nowIso = new Date().toISOString();

    // 2. Update payment to SUBMITTED
    await supabase
      .from('payments')
      .update({
        utr_number: cleanUtr,
        status: 'SUBMITTED',
        payment_method: 'UPI',
        submitted_at: nowIso,
        updated_at: nowIso,
      })
      .eq('booking_id', booking.id);

    // 3. Update booking status to SUBMITTED and extend reservation to 24h
    await supabase
      .from('bookings')
      .update({
        status: 'SUBMITTED',
        reserved_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        updated_at: nowIso,
      })
      .eq('id', booking.id);

    return new Response(
      JSON.stringify({
        success: true,
        bookingReference: booking.booking_reference,
        accessKey: booking.access_key,
        fullName: booking.full_name,
        mobile: booking.mobile,
        ticketType: booking.ticket_type,
        amount: booking.amount,
        bookingStatus: 'SUBMITTED',
        paymentStatus: 'SUBMITTED',
        utrNumber: cleanUtr,
        message: 'Payment reference submitted! Verification in progress.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error?.message || 'Payment submission failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
