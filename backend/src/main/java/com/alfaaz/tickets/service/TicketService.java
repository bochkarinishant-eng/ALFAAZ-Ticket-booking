package com.alfaaz.tickets.service;

import com.alfaaz.tickets.dto.ApiDtos.*;
import com.alfaaz.tickets.model.*;
import com.alfaaz.tickets.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class TicketService {

    private final EventRepository eventRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final TicketRepository ticketRepository;
    private final CheckInRepository checkInRepository;
    private final QrService qrService;
    private final PdfTicketService pdfTicketService;
    private final EmailService emailService;
    private final SecureRandom random = new SecureRandom();

    public TicketService(
        EventRepository eventRepository,
        BookingRepository bookingRepository,
        PaymentRepository paymentRepository,
        TicketRepository ticketRepository,
        CheckInRepository checkInRepository,
        QrService qrService,
        PdfTicketService pdfTicketService,
        EmailService emailService
    ) {
        this.eventRepository = eventRepository;
        this.bookingRepository = bookingRepository;
        this.paymentRepository = paymentRepository;
        this.ticketRepository = ticketRepository;
        this.checkInRepository = checkInRepository;
        this.qrService = qrService;
        this.pdfTicketService = pdfTicketService;
        this.emailService = emailService;
    }

    public Event getActiveEvent() {
        return eventRepository.findFirstByActiveTrueOrderByIdAsc()
            .orElseGet(() -> eventRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No active event found")));
    }

    @Transactional
    public EventSummaryResponse getEventSummary() {
        cleanExpiredReservations();
        Event event = getActiveEvent();
        long confirmed = bookingRepository.countByEventIdAndStatus(event.getId(), "CONFIRMED");
        long reserved = bookingRepository.countActivePendingReservations(event.getId(), LocalDateTime.now());
        long available = Math.max(0, event.getMaxCapacity() - (confirmed + reserved));

        return new EventSummaryResponse(
            event.getId(),
            event.getTitle(),
            event.getOrganizer(),
            event.getEventDateTime(),
            event.getVenue(),
            event.getMaxCapacity(),
            confirmed,
            reserved,
            available,
            event.getAudiencePrice(),
            event.getPerformerPrice(),
            event.getContactPhone(),
            event.getUpiId(),
            event.isActive()
        );
    }

    @Scheduled(fixedRate = 60000)
    @Transactional
    public void scheduledReservationCleanup() {
        cleanExpiredReservations();
    }

    @Transactional
    public void cleanExpiredReservations() {
        List<Booking> expired = bookingRepository.findExpiredReservations(LocalDateTime.now());
        for (Booking b : expired) {
            b.setStatus("EXPIRED");
            paymentRepository.findByBookingId(b.getId()).ifPresent(p -> {
                if ("PENDING".equals(p.getStatus())) {
                    p.setStatus("EXPIRED");
                }
            });
        }
    }

    @Transactional
    public ReserveSeatResponse reserveSeat(ReserveSeatRequest req) {
        cleanExpiredReservations();

        Event event = eventRepository.findByIdForUpdate(req.eventId() != null ? req.eventId() : getActiveEvent().getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));

        if (!event.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This event is currently not active for bookings.");
        }

        long confirmed = bookingRepository.countByEventIdAndStatus(event.getId(), "CONFIRMED");
        long activeReservations = bookingRepository.countActivePendingReservations(event.getId(), LocalDateTime.now());
        long totalOccupied = confirmed + activeReservations;

        if (totalOccupied >= event.getMaxCapacity()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sorry, Alfaaz Open Mic is FULL! All " + event.getMaxCapacity() + " seats are booked or currently reserved.");
        }

        String ticketType = "Performer".equalsIgnoreCase(req.ticketType()) ? "Performer" : "Audience";
        double amount = 100.0; // Both Audience and Performer fee is ₹100 only

        String bookingRef = "ALF-" + (2026) + "-" + generateRandomCode(6);
        String accessKey = UUID.randomUUID().toString().replace("-", "");
        LocalDateTime reservedUntil = LocalDateTime.now().plusMinutes(15);

        Booking booking = new Booking(
            event,
            bookingRef,
            req.fullName().trim(),
            req.mobile().trim(),
            req.email() != null ? req.email().trim().toLowerCase() : "",
            ticketType,
            "Performer".equals(ticketType) ? req.performerCategory() : null,
            "Performer".equals(ticketType) ? req.performanceDescription() : null,
            amount,
            reservedUntil,
            accessKey
        );

        Booking savedBooking = bookingRepository.save(booking);
        Payment payment = new Payment(savedBooking, amount);
        paymentRepository.save(payment);

        return new ReserveSeatResponse(
            savedBooking.getBookingReference(),
            savedBooking.getAccessKey(),
            savedBooking.getAmount(),
            savedBooking.getTicketType(),
            savedBooking.getReservedUntil(),
            event.getUpiId(),
            event.getContactPhone(),
            "Seat temporarily reserved for 15 minutes. Please complete UPI payment and submit your UTR."
        );
    }

    @Transactional
    public BookingStatusResponse submitPayment(String bookingRef, String utrNumber) {
        Booking booking = bookingRepository.findByBookingReference(bookingRef.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found with reference: " + bookingRef));

        if ("CONFIRMED".equals(booking.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking is already verified and confirmed.");
        }

        if ("CANCELLED".equals(booking.getStatus()) || "REJECTED".equals(booking.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking was " + booking.getStatus() + ". Cannot submit payment.");
        }

        if ("EXPIRED".equals(booking.getStatus()) || booking.getReservedUntil().isBefore(LocalDateTime.now())) {
            // Re-check capacity before reviving expired booking
            Event event = eventRepository.findByIdForUpdate(booking.getEvent().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));
            long confirmed = bookingRepository.countByEventIdAndStatus(event.getId(), "CONFIRMED");
            long activeReservations = bookingRepository.countActivePendingReservations(event.getId(), LocalDateTime.now());
            if (confirmed + activeReservations >= event.getMaxCapacity()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reservation expired and seats have filled up.");
            }
        }

        String cleanUtr = utrNumber.trim();
        if (cleanUtr.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please enter a valid UPI Reference / UTR Number.");
        }

        Payment payment = paymentRepository.findByBookingId(booking.getId())
            .orElseGet(() -> new Payment(booking, booking.getAmount()));

        payment.setUtrNumber(cleanUtr);
        payment.setStatus("SUBMITTED");
        payment.setSubmittedAt(LocalDateTime.now());
        paymentRepository.save(payment);

        booking.setStatus("SUBMITTED");
        booking.setReservedUntil(LocalDateTime.now().plusHours(24));
        bookingRepository.save(booking);

        return toStatusResponse(booking, payment, null);
    }

    public BookingStatusResponse getBookingStatus(String query) {
        String clean = query != null ? query.trim() : "";
        Optional<Booking> bookingOpt = bookingRepository.findByBookingReference(clean);
        if (bookingOpt.isEmpty()) {
            bookingOpt = bookingRepository.findByAccessKey(clean);
        }
        if (bookingOpt.isEmpty()) {
            String digits = clean.replaceAll("\\D", "");
            if (digits.length() >= 10) {
                String last10 = digits.substring(digits.length() - 10);
                List<Booking> byPhone = bookingRepository.findByMobileContainingOrderByCreatedAtDesc(last10);
                if (!byPhone.isEmpty()) {
                    bookingOpt = Optional.of(byPhone.get(0));
                }
            }
        }
        Booking booking = bookingOpt
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No booking found with this reference or mobile number: " + clean));
        Payment payment = paymentRepository.findByBookingId(booking.getId()).orElse(null);
        Ticket ticket = ticketRepository.findByBookingId(booking.getId()).orElse(null);
        return toStatusResponse(booking, payment, ticket);
    }

    public ConfirmedTicketResponse getConfirmedTicketByAccessKey(String accessKey) {
        Booking booking = bookingRepository.findByAccessKey(accessKey.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket access key is invalid"));

        if (!"CONFIRMED".equals(booking.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking payment is not yet confirmed. Current status: " + booking.getStatus());
        }

        Ticket ticket = ticketRepository.findByBookingId(booking.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Confirmed ticket record not found in system"));

        Payment payment = paymentRepository.findByBookingId(booking.getId()).orElse(null);
        String paymentStatus = payment != null ? payment.getStatus() : "PAID";
        String qrBase64 = qrService.pngBase64(ticket.getToken());

        return new ConfirmedTicketResponse(
            ticket.getTicketNumber(),
            booking.getBookingReference(),
            booking.getAccessKey(),
            ticket.getEvent().getTitle(),
            ticket.getEvent().getOrganizer(),
            ticket.getEvent().getEventDateTime(),
            ticket.getEvent().getVenue(),
            booking.getFullName(),
            booking.getMobile(),
            booking.getEmail(),
            booking.getTicketType(),
            booking.getPerformerCategory(),
            booking.getPerformanceDescription(),
            booking.getAmount(),
            paymentStatus,
            ticket.getStatus(),
            ticket.isAttended(),
            qrBase64,
            ticket.getCreatedAt(),
            ticket.getCheckedInAt()
        );
    }

    public byte[] getPdfTicket(String accessKey) {
        Booking booking = bookingRepository.findByAccessKey(accessKey.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        if (!"CONFIRMED".equals(booking.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticket is not confirmed");
        }
        Ticket ticket = ticketRepository.findByBookingId(booking.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        return pdfTicketService.generateTicketPdf(ticket);
    }

    public byte[] getQrPng(String accessKey) {
        Booking booking = bookingRepository.findByAccessKey(accessKey.trim())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        if (!"CONFIRMED".equals(booking.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ticket is not confirmed");
        }
        Ticket ticket = ticketRepository.findByBookingId(booking.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));
        return qrService.pngBytes(ticket.getToken());
    }

    @Transactional
    public ConfirmedTicketResponse adminApprovePayment(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment record not found"));

        Booking booking = payment.getBooking();
        Event event = eventRepository.findByIdForUpdate(booking.getEvent().getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));

        if (!"CONFIRMED".equals(booking.getStatus())) {
            long confirmed = bookingRepository.countByEventIdAndStatus(event.getId(), "CONFIRMED");
            if (confirmed >= event.getMaxCapacity()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot approve: Maximum capacity of " + event.getMaxCapacity() + " confirmed seats has already been reached!");
            }
        }

        payment.setStatus("VERIFIED");
        payment.setVerifiedAt(LocalDateTime.now());
        paymentRepository.save(payment);

        booking.setStatus("CONFIRMED");
        bookingRepository.save(booking);

        Ticket ticket = ticketRepository.findByBookingId(booking.getId()).orElse(null);
        if (ticket == null) {
            byte[] tokenBytes = new byte[32];
            random.nextBytes(tokenBytes);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);

            long count = ticketRepository.countByEventId(event.getId()) + 1;
            String ticketNumber = String.format("ALF-TKT-%03d", count);

            ticket = new Ticket(booking, event, ticketNumber, token);
            ticket = ticketRepository.save(ticket);
        }

        emailService.sendBookingConfirmation(booking, ticket);
        return getConfirmedTicketByAccessKey(booking.getAccessKey());
    }

    @Transactional
    public void adminRejectPayment(Long paymentId, String reason) {
        Payment payment = paymentRepository.findById(paymentId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment record not found"));

        payment.setStatus("REJECTED");
        payment.setRejectionReason(reason != null && !reason.isBlank() ? reason : "UTR verification failed");
        paymentRepository.save(payment);

        Booking booking = payment.getBooking();
        booking.setStatus("REJECTED");
        bookingRepository.save(booking);

        ticketRepository.findByBookingId(booking.getId()).ifPresent(t -> {
            t.setStatus("CANCELLED");
            ticketRepository.save(t);
        });
    }

    @Transactional
    public void adminCancelTicket(Long ticketId, String reason) {
        Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Ticket not found"));

        ticket.setStatus("CANCELLED");
        ticketRepository.save(ticket);

        Booking booking = ticket.getBooking();
        booking.setStatus("CANCELLED");
        bookingRepository.save(booking);
    }

    @Transactional
    public CheckInResponse checkIn(String token) {
        if (token == null || token.isBlank()) {
            return new CheckInResponse(false, "INVALID TICKET", null, null, null, null, null, "Empty QR code token");
        }

        Optional<Ticket> ticketOpt = ticketRepository.findByTokenForUpdate(token.trim());
        if (ticketOpt.isEmpty()) {
            checkInRepository.save(new CheckIn(null, token, "INVALID", "Unknown"));
            return new CheckInResponse(false, "INVALID TICKET", null, null, null, null, null, "This QR code does not match any ticket in Alfaaz records.");
        }

        Ticket ticket = ticketOpt.get();
        Booking booking = ticket.getBooking();

        if ("CANCELLED".equals(ticket.getStatus()) || "CANCELLED".equals(booking.getStatus())) {
            checkInRepository.save(new CheckIn(ticket, token, "CANCELLED", booking.getFullName()));
            return new CheckInResponse(false, "TICKET CANCELLED", booking.getFullName(), ticket.getTicketNumber(), booking.getTicketType(), booking.getPerformerCategory(), null, "This ticket was cancelled.");
        }

        if (!"CONFIRMED".equals(booking.getStatus())) {
            checkInRepository.save(new CheckIn(ticket, token, "PAYMENT_NOT_VERIFIED", booking.getFullName()));
            return new CheckInResponse(false, "PAYMENT NOT VERIFIED", booking.getFullName(), ticket.getTicketNumber(), booking.getTicketType(), booking.getPerformerCategory(), null, "Payment for this ticket has not been verified.");
        }

        if ("USED".equals(ticket.getStatus()) || ticket.getCheckedInAt() != null) {
            checkInRepository.save(new CheckIn(ticket, token, "ALREADY_USED", booking.getFullName()));
            return new CheckInResponse(
                false,
                "ALREADY CHECKED IN",
                booking.getFullName(),
                ticket.getTicketNumber(),
                booking.getTicketType(),
                booking.getPerformerCategory(),
                ticket.getCheckedInAt(),
                "This ticket has already been used for entry!"
            );
        }

        // Valid Ticket -> Approve Entry
        ticket.setStatus("USED");
        ticket.setCheckedInAt(LocalDateTime.now());
        ticket.setAttended(true);
        ticketRepository.save(ticket);

        checkInRepository.save(new CheckIn(ticket, token, "APPROVED", booking.getFullName()));

        return new CheckInResponse(
            true,
            "ENTRY APPROVED",
            booking.getFullName(),
            ticket.getTicketNumber(),
            booking.getTicketType(),
            booking.getPerformerCategory(),
            ticket.getCheckedInAt(),
            "Welcome to Alfaaz Open Mic! Entry Approved."
        );
    }

    public AdminStatsResponse getAdminStats() {
        Event event = getActiveEvent();
        long confirmed = bookingRepository.countByEventIdAndStatus(event.getId(), "CONFIRMED");
        long activeReservations = bookingRepository.countActivePendingReservations(event.getId(), LocalDateTime.now());
        long displayCapacity = 40;
        long remaining = Math.max(0, displayCapacity - confirmed);

        long audience = bookingRepository.countByEventIdAndTicketTypeAndStatus(event.getId(), "Audience", "CONFIRMED");
        long performers = bookingRepository.countByEventIdAndTicketTypeAndStatus(event.getId(), "Performer", "CONFIRMED");

        long pending = paymentRepository.countByStatus("PENDING");
        long submitted = paymentRepository.countByStatus("SUBMITTED");
        long verified = paymentRepository.countByStatus("VERIFIED");
        long checkedIn = ticketRepository.countByEventIdAndAttendedTrue(event.getId());

        return new AdminStatsResponse(
            (int) displayCapacity,
            confirmed,
            remaining,
            activeReservations,
            audience,
            performers,
            pending,
            submitted,
            verified,
            checkedIn
        );
    }

    public List<AdminBookingItemResponse> getAdminBookings(String q, String category, String status) {
        Event event = getActiveEvent();
        List<Booking> list = (q != null && !q.isBlank())
            ? bookingRepository.searchBookings(event.getId(), q.trim())
            : bookingRepository.findByEventIdOrderByCreatedAtDesc(event.getId());

        List<AdminBookingItemResponse> result = new ArrayList<>();
        for (Booking b : list) {
            if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
                if (!category.equalsIgnoreCase(b.getTicketType())) continue;
            }
            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                if (!status.equalsIgnoreCase(b.getStatus())) continue;
            }

            Payment payment = paymentRepository.findByBookingId(b.getId()).orElse(null);
            Ticket ticket = ticketRepository.findByBookingId(b.getId()).orElse(null);

            result.add(new AdminBookingItemResponse(
                b.getId(),
                b.getBookingReference(),
                b.getAccessKey(),
                b.getFullName(),
                b.getMobile(),
                b.getEmail(),
                b.getTicketType(),
                b.getPerformerCategory(),
                b.getPerformanceDescription(),
                b.getAmount(),
                b.getStatus(),
                payment != null ? payment.getStatus() : "PENDING",
                payment != null ? payment.getUtrNumber() : null,
                ticket != null ? ticket.getTicketNumber() : null,
                ticket != null && ticket.isAttended(),
                b.getCreatedAt()
            ));
        }
        return result;
    }

    public String exportAttendeesCsv() {
        Event event = getActiveEvent();
        List<Booking> list = bookingRepository.findByEventIdOrderByCreatedAtDesc(event.getId());

        StringBuilder sb = new StringBuilder();
        sb.append("Ticket Number,Booking Reference,Full Name,Mobile,Email,Category,Genre/Description,Amount (INR),Booking Status,Payment Status,UTR Number,Attended,Checked-In Time,Created At\n");

        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        for (Booking b : list) {
            Payment p = paymentRepository.findByBookingId(b.getId()).orElse(null);
            Ticket t = ticketRepository.findByBookingId(b.getId()).orElse(null);

            sb.append(escapeCsv(t != null ? t.getTicketNumber() : "")).append(",");
            sb.append(escapeCsv(b.getBookingReference())).append(",");
            sb.append(escapeCsv(b.getFullName())).append(",");
            sb.append(escapeCsv(b.getMobile())).append(",");
            sb.append(escapeCsv(b.getEmail())).append(",");
            sb.append(escapeCsv(b.getTicketType())).append(",");
            String genreDesc = (b.getPerformerCategory() != null ? b.getPerformerCategory() : "") +
                (b.getPerformanceDescription() != null ? " - " + b.getPerformanceDescription() : "");
            sb.append(escapeCsv(genreDesc)).append(",");
            sb.append(b.getAmount()).append(",");
            sb.append(escapeCsv(b.getStatus())).append(",");
            sb.append(escapeCsv(p != null ? p.getStatus() : "PENDING")).append(",");
            sb.append(escapeCsv(p != null && p.getUtrNumber() != null ? p.getUtrNumber() : "")).append(",");
            sb.append(t != null && t.isAttended() ? "YES" : "NO").append(",");
            sb.append(t != null && t.getCheckedInAt() != null ? t.getCheckedInAt().format(dtf) : "").append(",");
            sb.append(b.getCreatedAt() != null ? b.getCreatedAt().format(dtf) : "").append("\n");
        }
        return sb.toString();
    }

    private String escapeCsv(String val) {
        if (val == null) return "";
        if (val.contains(",") || val.contains("\"") || val.contains("\n")) {
            return "\"" + val.replace("\"", "\"\"") + "\"";
        }
        return val;
    }

    private BookingStatusResponse toStatusResponse(Booking b, Payment p, Ticket t) {
        return new BookingStatusResponse(
            b.getBookingReference(),
            b.getAccessKey(),
            b.getFullName(),
            b.getMobile(),
            b.getEmail(),
            b.getTicketType(),
            b.getPerformerCategory(),
            b.getPerformanceDescription(),
            b.getAmount(),
            b.getStatus(),
            p != null ? p.getStatus() : "PENDING",
            p != null ? p.getUtrNumber() : null,
            t != null ? t.getTicketNumber() : null,
            b.getReservedUntil()
        );
    }

    private String generateRandomCode(int length) {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
