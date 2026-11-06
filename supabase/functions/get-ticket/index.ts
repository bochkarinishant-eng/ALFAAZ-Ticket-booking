import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const accessKey = url.searchParams.get('accessKey') || url.searchParams.get('key') || '';

    if (!accessKey.trim()) {
      return new Response(JSON.stringify({ error: 'Ticket access key is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();

    // Fetch booking
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select('*, event:events(*), payment:payments(*)')
      .eq('access_key', accessKey.trim())
      .single();

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ error: 'Ticket access key is invalid' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (booking.status !== 'CONFIRMED') {
      return new Response(
        JSON.stringify({
          error: `Booking payment is not yet confirmed. Current status: ${booking.status}`,
          status: booking.status,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch ticket
    const { data: ticket, error: ticketErr } = await supabase
      .from('tickets')
      .select('*')
      .eq('booking_id', booking.id)
      .single();

    if (ticketErr || !ticket) {
      return new Response(JSON.stringify({ error: 'Confirmed ticket record not found in system' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payment = Array.isArray(booking.payment) ? booking.payment[0] : booking.payment;
    const event = booking.event;

    return new Response(
      JSON.stringify({
        ticketNumber: ticket.ticket_number,
        bookingReference: booking.booking_reference,
        accessKey: booking.access_key,
        eventTitle: event?.title || 'Alfaaz Open Mic',
        organizer: event?.organizer || 'Alfaaz',
        eventDateTime: event?.event_date_time,
        venue: event?.venue || 'Beyond Temptation, Ashegaon Road, Basmat',
        fullName: booking.full_name,
        mobile: booking.mobile,
        email: booking.email,
        ticketType: booking.ticket_type,
        performerCategory: booking.performer_category,
        performanceDescription: booking.performance_description,
        amount: booking.amount,
        paymentStatus: payment?.status || 'VERIFIED',
        ticketStatus: ticket.status,
        attended: ticket.attended,
        qrToken: ticket.qr_token,
        createdAt: ticket.created_at,
        checkedInAt: ticket.checked_in_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error?.message || 'Failed to retrieve ticket' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
