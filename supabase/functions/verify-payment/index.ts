import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { verifyRazorpaySignature } from '../_shared/razorpay.ts';

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
    const { bookingReference, razorpay_order_id, razorpay_payment_id, razorpay_signature, utrNumber } = body;

    if (!bookingReference) {
      return new Response(JSON.stringify({ error: 'bookingReference is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // A. Manual UPI UTR Submission flow
    if (utrNumber && !razorpay_signature) {
      const cleanUtr = utrNumber.trim();
      if (cleanUtr.length < 6) {
        return new Response(JSON.stringify({ error: 'Please enter a valid UPI Reference / UTR Number (minimum 6 digits).' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('payments')
        .update({
          utr_number: cleanUtr,
          status: 'SUBMITTED',
          submitted_at: new Date().toISOString(),
          payment_method: 'UPI',
          updated_at: new Date().toISOString(),
        })
        .eq('booking_id', booking.id);

      await supabase
        .from('bookings')
        .update({
          status: 'SUBMITTED',
          reserved_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      return new Response(
        JSON.stringify({
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
    }

    // B. Razorpay Verification Flow
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(JSON.stringify({ error: 'Missing Razorpay payment verification parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isValidSignature = await verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValidSignature) {
      // Mark payment as FAILED
      await supabase
        .from('payments')
        .update({
          status: 'FAILED',
          rejection_reason: 'Invalid cryptographic signature',
          updated_at: new Date().toISOString(),
        })
        .eq('booking_id', booking.id);

      return new Response(JSON.stringify({ error: 'Invalid payment signature verification' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Signature verified! Update payment status
    const nowIso = new Date().toISOString();
    await supabase
      .from('payments')
      .update({
        razorpay_payment_id: razorpay_payment_id,
        razorpay_signature: razorpay_signature,
        status: 'VERIFIED',
        verified_at: nowIso,
        updated_at: nowIso,
      })
      .eq('booking_id', booking.id);

    // Update booking status
    await supabase
      .from('bookings')
      .update({
        status: 'CONFIRMED',
        updated_at: nowIso,
      })
      .eq('id', booking.id);

    // Issue ticket if not yet issued
    let { data: ticket } = await supabase
      .from('tickets')
      .select('*')
      .eq('booking_id', booking.id)
      .maybeSingle();

    if (!ticket) {
      const { count: ticketCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', booking.event_id);

      const ticketSeq = (ticketCount || 0) + 1;
      const ticketNumber = `ALF-TKT-${String(ticketSeq).padStart(3, '0')}`;

      // Cryptographically secure QR token
      const tokenBuffer = new Uint8Array(32);
      crypto.getRandomValues(tokenBuffer);
      const qrToken = btoa(String.fromCharCode(...tokenBuffer))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const { data: newTicket, error: ticketErr } = await supabase
        .from('tickets')
        .insert({
          ticket_number: ticketNumber,
          booking_id: booking.id,
          event_id: booking.event_id,
          qr_token: qrToken,
          buyer_name: booking.full_name,
          buyer_phone: booking.mobile,
          ticket_type: booking.ticket_type,
          status: 'ACTIVE',
          attended: false,
        })
        .select()
        .single();

      if (ticketErr) {
        console.error('Error creating ticket:', ticketErr);
      } else {
        ticket = newTicket;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment verified and ticket confirmed!',
        accessKey: booking.access_key,
        bookingReference: booking.booking_reference,
        ticketNumber: ticket?.ticket_number,
        bookingStatus: 'CONFIRMED',
        paymentStatus: 'VERIFIED',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error?.message || 'Payment verification failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
