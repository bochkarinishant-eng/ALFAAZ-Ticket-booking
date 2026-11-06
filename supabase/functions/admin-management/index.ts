import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabaseClient.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();

    // 1. Authenticate Admin
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify token with Supabase Auth
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin role in profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role !== 'ADMIN') {
      return new Response(JSON.stringify({ error: 'Access denied: Admin privileges required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || (req.method === 'GET' ? 'stats' : '');

    // 2. Action: Stats
    if (action === 'stats') {
      const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!event) {
        return new Response(JSON.stringify({ error: 'Active event not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { count: confirmed } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'CONFIRMED');

      const { count: activeReservations } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .in('status', ['PENDING', 'SUBMITTED'])
        .gt('reserved_until', new Date().toISOString());

      const displayCapacity = 40;
      const remaining = Math.max(0, displayCapacity - (confirmed || 0));

      const { count: audience } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('ticket_type', 'Audience')
        .eq('status', 'CONFIRMED');

      const { count: performers } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('ticket_type', 'Performer')
        .eq('status', 'CONFIRMED');

      const { count: pending } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      const { count: submitted } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'SUBMITTED');

      const { count: verified } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'VERIFIED');

      const { count: checkedIn } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('attended', true);

      return new Response(
        JSON.stringify({
          displayCapacity,
          confirmed: confirmed || 0,
          remaining,
          activeReservations: activeReservations || 0,
          audience: audience || 0,
          performers: performers || 0,
          pending: pending || 0,
          submitted: submitted || 0,
          verified: verified || 0,
          checkedIn: checkedIn || 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Action: Bookings List
    if (action === 'bookings') {
      const q = url.searchParams.get('q') || '';
      const category = url.searchParams.get('category') || 'ALL';
      const status = url.searchParams.get('status') || 'ALL';

      let query = supabase
        .from('bookings')
        .select('*, payment:payments(*), ticket:tickets(*)')
        .order('created_at', { ascending: false });

      if (category !== 'ALL') {
        query = query.eq('ticket_type', category);
      }

      if (status !== 'ALL') {
        query = query.eq('status', status);
      }

      if (q.trim()) {
        const searchTerm = `%${q.trim()}%`;
        query = query.or(`full_name.ilike.${searchTerm},mobile.ilike.${searchTerm},booking_reference.ilike.${searchTerm}`);
      }

      const { data: bookings, error: bookingsErr } = await query;
      if (bookingsErr) throw bookingsErr;

      const formatted = (bookings || []).map((b) => {
        const p = Array.isArray(b.payment) ? b.payment[0] : b.payment;
        const t = Array.isArray(b.ticket) ? b.ticket[0] : b.ticket;
        return {
          id: b.id,
          paymentId: p?.id || null,
          ticketId: t?.id || null,
          bookingReference: b.booking_reference,
          accessKey: b.access_key,
          fullName: b.full_name,
          mobile: b.mobile,
          email: b.email,
          ticketType: b.ticket_type,
          performerCategory: b.performer_category,
          performanceDescription: b.performance_description,
          amount: b.amount,
          status: b.status,
          paymentStatus: p?.status || 'PENDING',
          utrNumber: p?.utr_number || null,
          ticketNumber: t?.ticket_number || null,
          attended: t?.attended || false,
          createdAt: b.created_at,
        };
      });

      return new Response(JSON.stringify(formatted), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Action: Approve Payment
    if (action === 'approve_payment' && req.method === 'POST') {
      const body = await req.json();
      const { paymentId } = body;

      // Look up by payment ID or by booking ID
      let { data: payment } = await supabase
        .from('payments')
        .select('*, booking:bookings(*)')
        .eq('id', paymentId)
        .maybeSingle();

      if (!payment) {
        const res = await supabase
          .from('payments')
          .select('*, booking:bookings(*)')
          .eq('booking_id', paymentId)
          .maybeSingle();
        payment = res.data;
      }

      if (!payment) {
        return new Response(JSON.stringify({ error: 'Payment not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const booking = payment.booking;
      const nowIso = new Date().toISOString();

      await supabase
        .from('payments')
        .update({ status: 'VERIFIED', verified_at: nowIso, updated_at: nowIso })
        .eq('id', payment.id);

      await supabase
        .from('bookings')
        .update({ status: 'CONFIRMED', updated_at: nowIso })
        .eq('id', booking.id);

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

        const tokenBuffer = new Uint8Array(32);
        crypto.getRandomValues(tokenBuffer);
        const qrToken = btoa(String.fromCharCode(...tokenBuffer))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const { data: newTicket } = await supabase
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

        ticket = newTicket;
      }

      // Log audit
      await supabase.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'APPROVE_PAYMENT',
        details: { paymentId: payment.id, bookingId: booking.id, ticketNumber: ticket?.ticket_number },
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Payment approved and ticket issued successfully!' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Action: Reject Payment
    if (action === 'reject_payment' && req.method === 'POST') {
      const body = await req.json();
      const { paymentId, reason } = body;

      let { data: payment } = await supabase
        .from('payments')
        .select('*, booking:bookings(*)')
        .eq('id', paymentId)
        .maybeSingle();

      if (!payment) {
        const res = await supabase
          .from('payments')
          .select('*, booking:bookings(*)')
          .eq('booking_id', paymentId)
          .maybeSingle();
        payment = res.data;
      }

      if (!payment) {
        return new Response(JSON.stringify({ error: 'Payment not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const nowIso = new Date().toISOString();
      await supabase
        .from('payments')
        .update({
          status: 'REJECTED',
          rejection_reason: reason || 'Payment verification failed',
          updated_at: nowIso,
        })
        .eq('id', payment.id);

      await supabase
        .from('bookings')
        .update({ status: 'REJECTED', updated_at: nowIso })
        .eq('id', payment.booking_id);

      await supabase
        .from('tickets')
        .update({ status: 'CANCELLED' })
        .eq('booking_id', payment.booking_id);

      await supabase.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'REJECT_PAYMENT',
        details: { paymentId, reason },
      });

      return new Response(JSON.stringify({ success: true, message: 'Payment rejected' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Action: Cancel Ticket
    if (action === 'cancel_ticket' && req.method === 'POST') {
      const body = await req.json();
      const { ticketId, reason } = body;

      let { data: ticket } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .maybeSingle();

      if (!ticket) {
        const res = await supabase
          .from('tickets')
          .select('*')
          .eq('booking_id', ticketId)
          .maybeSingle();
        ticket = res.data;
      }

      if (!ticket) {
        return new Response(JSON.stringify({ error: 'Ticket not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase
        .from('tickets')
        .update({ status: 'CANCELLED' })
        .eq('id', ticket.id);

      await supabase
        .from('bookings')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', ticket.booking_id);

      await supabase.from('admin_audit_logs').insert({
        admin_id: user.id,
        action: 'CANCEL_TICKET',
        details: { ticketId, reason },
      });

      return new Response(JSON.stringify({ success: true, message: 'Ticket cancelled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Action: Export CSV
    if (action === 'export_csv') {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, payment:payments(*), ticket:tickets(*)')
        .order('created_at', { ascending: false });

      let csv = 'Ticket Number,Booking Reference,Full Name,Mobile,Email,Category,Genre/Description,Amount (INR),Booking Status,Payment Status,UTR / Payment ID,Attended,Checked-In Time,Created At\n';

      const escapeCsv = (val: string | null | undefined) => {
        if (!val) return '';
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };

      for (const b of bookings || []) {
        const p = Array.isArray(b.payment) ? b.payment[0] : b.payment;
        const t = Array.isArray(b.ticket) ? b.ticket[0] : b.ticket;
        const genreDesc = (b.performer_category || '') + (b.performance_description ? ` - ${b.performance_description}` : '');

        csv += [
          escapeCsv(t?.ticket_number),
          escapeCsv(b.booking_reference),
          escapeCsv(b.full_name),
          escapeCsv(b.mobile),
          escapeCsv(b.email),
          escapeCsv(b.ticket_type),
          escapeCsv(genreDesc),
          b.amount,
          escapeCsv(b.status),
          escapeCsv(p?.status || 'PENDING'),
          escapeCsv(p?.utr_number || ''),
          t?.attended ? 'YES' : 'NO',
          escapeCsv(t?.checked_in_at || ''),
          escapeCsv(b.created_at || ''),
        ].join(',') + '\n';
      }

      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv; charset=UTF-8',
          'Content-Disposition': 'attachment; filename="Alfaaz-Attendees.csv"',
        },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return new Response(JSON.stringify({ error: error?.message || 'Admin operation failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
