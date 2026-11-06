package com.alfaaz.tickets.controller;

import com.alfaaz.tickets.dto.ApiDtos.*;
import com.alfaaz.tickets.model.Event;
import com.alfaaz.tickets.service.AdminAuthService;
import com.alfaaz.tickets.service.TicketService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ApiController {

    private final TicketService ticketService;
    private final AdminAuthService adminAuthService;

    public ApiController(TicketService ticketService, AdminAuthService adminAuthService) {
        this.ticketService = ticketService;
        this.adminAuthService = adminAuthService;
    }

    // --- EVENT & SEAT ENDPOINTS ---

    @GetMapping("/events/active")
    public EventSummaryResponse getActiveEvent() {
        return ticketService.getEventSummary();
    }

    @GetMapping("/events")
    public List<EventSummaryResponse> getAllEvents() {
        return List.of(ticketService.getEventSummary());
    }

    // --- BOOKING & PAYMENT SUBMISSION ---

    @PostMapping("/bookings/reserve")
    public ResponseEntity<ReserveSeatResponse> reserveSeat(@Valid @RequestBody ReserveSeatRequest req) {
        ReserveSeatResponse resp = ticketService.reserveSeat(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @PostMapping("/bookings/{bookingRef}/submit-payment")
    public BookingStatusResponse submitPayment(
            @PathVariable String bookingRef,
            @Valid @RequestBody SubmitPaymentRequest req) {
        return ticketService.submitPayment(bookingRef, req.utrNumber());
    }

    @GetMapping("/bookings/{bookingRef}/status")
    public BookingStatusResponse getBookingStatus(@PathVariable String bookingRef) {
        return ticketService.getBookingStatus(bookingRef);
    }

    // --- CONFIRMED TICKET ACCESS & DOWNLOADS ---

    @GetMapping("/tickets/access/{accessKey}")
    public ConfirmedTicketResponse getTicketByAccessKey(@PathVariable String accessKey) {
        return ticketService.getConfirmedTicketByAccessKey(accessKey);
    }

    @GetMapping("/tickets/{accessKey}/pdf")
    public ResponseEntity<byte[]> downloadTicketPdf(@PathVariable String accessKey) {
        byte[] pdfBytes = ticketService.getPdfTicket(accessKey);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename("Alfaaz-Ticket.pdf").build());
        return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
    }

    @GetMapping("/tickets/{accessKey}/qr")
    public ResponseEntity<byte[]> downloadTicketQr(@PathVariable String accessKey) {
        byte[] qrBytes = ticketService.getQrPng(accessKey);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.IMAGE_PNG);
        headers.setContentDisposition(ContentDisposition.attachment().filename("Alfaaz-Ticket-QR.png").build());
        return new ResponseEntity<>(qrBytes, headers, HttpStatus.OK);
    }

    // --- QR SCANNER DOOR CHECK-IN ---

    @PostMapping("/check-in")
    public CheckInResponse checkIn(@Valid @RequestBody CheckInRequest req) {
        return ticketService.checkIn(req.token());
    }

    // --- ADMIN AUTH ---

    @PostMapping("/auth/login")
    public ResponseEntity<AdminLoginResponse> adminLogin(@Valid @RequestBody AdminLoginRequest req) {
        AdminLoginResponse resp = adminAuthService.login(req);
        if (!resp.success()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(resp);
        }
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<Void> adminLogout(@RequestHeader(value = "Authorization", required = false) String auth) {
        if (auth != null && auth.startsWith("Bearer ")) {
            adminAuthService.logout(auth.substring(7));
        }
        return ResponseEntity.ok().build();
    }

    // --- PROTECTED ADMIN OPERATIONS ---

    @GetMapping("/admin/stats")
    public AdminStatsResponse getAdminStats() {
        return ticketService.getAdminStats();
    }

    @GetMapping("/admin/bookings")
    public List<AdminBookingItemResponse> getAdminBookings(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status) {
        return ticketService.getAdminBookings(q, category, status);
    }

    @PostMapping("/admin/payments/{paymentId}/approve")
    public ConfirmedTicketResponse approvePayment(@PathVariable Long paymentId) {
        return ticketService.adminApprovePayment(paymentId);
    }

    @PostMapping("/admin/payments/{paymentId}/reject")
    public ResponseEntity<Void> rejectPayment(
            @PathVariable Long paymentId,
            @RequestBody(required = false) PaymentActionRequest req) {
        ticketService.adminRejectPayment(paymentId, req != null ? req.reason() : null);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/admin/tickets/{ticketId}/cancel")
    public ResponseEntity<Void> cancelTicket(
            @PathVariable Long ticketId,
            @RequestBody(required = false) PaymentActionRequest req) {
        ticketService.adminCancelTicket(ticketId, req != null ? req.reason() : null);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/admin/export-csv")
    public ResponseEntity<byte[]> exportAttendeesCsv() {
        String csv = ticketService.exportAttendeesCsv();
        byte[] bytes = csv.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDisposition(ContentDisposition.attachment().filename("Alfaaz-Attendees.csv").build());
        return new ResponseEntity<>(bytes, headers, HttpStatus.OK);
    }
}
