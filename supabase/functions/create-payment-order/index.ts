import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { createRazorpayOrder } from '../_shared/razorpay.ts';

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
    const { bookingReference } = body;

    if (!bookingReference) {
      return new Response(JSON.stringify({ error: 'bookingReference is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();

    // 1. Fetch booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('*, event:events(*)')
      .eq('booking_reference', bookingReference.trim())
      .single();

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (booking.status === 'CONFIRMED') {
      return new Response(JSON.stringify({ error: 'Booking is already confirmed' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (['CANCELLED', 'EXPIRED', 'REJECTED'].includes(booking.status)) {
      return new Response(JSON.stringify({ error: `Booking is ${booking.status}. Please make a new reservation.` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const amountInPaise = Math.round(Number(booking.amount) * 100);
    if (amountInPaise < 100) {
      return new Response(JSON.stringify({ error: 'Minimum transaction amount is 100 paise (₹1)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Create Razorpay order
    const razorpayOrder = await createRazorpayOrder({
      amountInPaise,
      currency: 'INR',
      receipt: booking.booking_reference,
      notes: {
        bookingId: booking.id,
        bookingReference: booking.booking_reference,
        attendeeName: booking.full_name,
        ticketType: booking.ticket_type,
      },
    });

    // 3. Update payment record with razorpay_order_id
    await supabase
      .from('payments')
      .update({
        razorpay_order_id: razorpayOrder.id,
        amount: booking.amount,
        status: 'PENDING',
        payment_method: 'RAZORPAY',
        updated_at: new Date().toISOString(),
      })
      .eq('booking_id', booking.id);

    const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID') || '';

    return new Response(
      JSON.stringify({
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        keyId: razorpayKeyId,
        bookingReference: booking.booking_reference,
        customerName: booking.full_name,
        customerEmail: booking.email,
        customerPhone: booking.mobile,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error?.message || 'Failed to create payment order' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
