import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';
import { verifyRazorpayWebhookSignature } from '../_shared/razorpay.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const signature = req.headers.get('x-razorpay-signature') || '';
    const rawBody = await req.text();

    const isValid = await verifyRazorpayWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.error('Invalid Razorpay webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payload = event.payload;

    const supabase = getServiceClient();

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const paymentId = paymentEntity?.id;

      if (orderId) {
        // Find payment by razorpay_order_id
        const { data: paymentRecord } = await supabase
          .from('payments')
          .select('*, booking:bookings(*)')
          .eq('razorpay_order_id', orderId)
          .maybeSingle();

        if (paymentRecord && paymentRecord.booking) {
          const nowIso = new Date().toISOString();
          await supabase
            .from('payments')
            .update({
              razorpay_payment_id: paymentId,
              status: 'VERIFIED',
              verified_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', paymentRecord.id);

          await supabase
            .from('bookings')
            .update({
              status: 'CONFIRMED',
              updated_at: nowIso,
            })
            .eq('id', paymentRecord.booking.id);

          // Check if ticket already created
          const { data: existingTicket } = await supabase
            .from('tickets')
            .select('id')
            .eq('booking_id', paymentRecord.booking.id)
            .maybeSingle();

          if (!existingTicket) {
            const { count: ticketCount } = await supabase
              .from('tickets')
              .select('*', { count: 'exact', head: true })
              .eq('event_id', paymentRecord.booking.event_id);

            const ticketSeq = (ticketCount || 0) + 1;
            const ticketNumber = `ALF-TKT-${String(ticketSeq).padStart(3, '0')}`;

            const tokenBuffer = new Uint8Array(32);
            crypto.getRandomValues(tokenBuffer);
            const qrToken = btoa(String.fromCharCode(...tokenBuffer))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, '');

            await supabase.from('tickets').insert({
              ticket_number: ticketNumber,
              booking_id: paymentRecord.booking.id,
              event_id: paymentRecord.booking.event_id,
              qr_token: qrToken,
              buyer_name: paymentRecord.booking.full_name,
              buyer_phone: paymentRecord.booking.mobile,
              ticket_type: paymentRecord.booking.ticket_type,
              status: 'ACTIVE',
              attended: false,
            });
          }
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const errorDesc = paymentEntity?.error_description || 'Payment failed';

      if (orderId) {
        await supabase
          .from('payments')
          .update({
            status: 'FAILED',
            rejection_reason: errorDesc,
            updated_at: new Date().toISOString(),
          })
          .eq('razorpay_order_id', orderId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Webhook processing failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
