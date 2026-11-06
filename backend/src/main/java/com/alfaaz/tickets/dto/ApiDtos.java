package com.alfaaz.tickets.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

public final class ApiDtos {
    private ApiDtos() {}

    public record EventSummaryResponse(
        Long id,
        String title,
        String organizer,
        LocalDateTime eventDateTime,
        String venue,
        int maxCapacity,
        long confirmedSeats,
        long reservedSeats,
        long availableSeats,
        double audiencePrice,
        double performerPrice,
        String contactPhone,
        String upiId,
        boolean active
    ) {}

    public record ReserveSeatRequest(
        Long eventId,
        @NotBlank(message = "Full name is required") String fullName,
        @NotBlank(message = "Mobile number is required") String mobile,
        String email,
        @NotBlank(message = "Ticket type is required") String ticketType,
        String performerCategory,
        String performanceDescription
    ) {}

    public record ReserveSeatResponse(
        String bookingReference,
        String accessKey,
        double amount,
        String ticketType,
        LocalDateTime reservedUntil,
        String upiId,
        String contactPhone,
        String message
    ) {}

    public record SubmitPaymentRequest(
        @NotBlank(message = "UTR / Transaction number is required") String utrNumber
    ) {}

    public record BookingStatusResponse(
        String bookingReference,
        String accessKey,
        String fullName,
        String mobile,
        String email,
        String ticketType,
        String performerCategory,
        String performanceDescription,
        double amount,
        String bookingStatus,
        String paymentStatus,
        String utrNumber,
        String ticketNumber,
        LocalDateTime reservedUntil
    ) {}

    public record ConfirmedTicketResponse(
        String ticketNumber,
        String bookingReference,
        String accessKey,
        String eventTitle,
        String organizer,
        LocalDateTime eventDateTime,
        String venue,
        String attendeeName,
        String mobile,
        String email,
        String ticketType,
        String performerCategory,
        String performanceDescription,
        double amount,
        String paymentStatus,
        String ticketStatus,
        boolean attended,
        String qrPngBase64,
        LocalDateTime createdAt,
        LocalDateTime checkedInAt
    ) {}

    public record CheckInRequest(
        @NotBlank(message = "Token is required") String token
    ) {}

    public record CheckInResponse(
        boolean accepted,
        String result,
        String attendeeName,
        String ticketId,
        String ticketType,
        String performerCategory,
        LocalDateTime checkedInAt,
        String message
    ) {}

    public record AdminLoginRequest(
        @NotBlank String username,
        @NotBlank String password
    ) {}

    public record AdminLoginResponse(
        boolean success,
        String token,
        String username,
        String role,
        String message
    ) {}

    public record PaymentActionRequest(
        String reason
    ) {}

    public record AdminStatsResponse(
        int totalCapacity,
        long confirmedBookings,
        long remainingSeats,
        long activeReservations,
        long audienceBookings,
        long performerBookings,
        long pendingPayments,
        long submittedPayments,
        long verifiedPayments,
        long checkedInAttendees
    ) {}

    public record AdminBookingItemResponse(
        Long id,
        String bookingReference,
        String accessKey,
        String fullName,
        String mobile,
        String email,
        String ticketType,
        String performerCategory,
        String performanceDescription,
        double amount,
        String status,
        String paymentStatus,
        String utrNumber,
        String ticketNumber,
        boolean attended,
        LocalDateTime createdAt
    ) {}
}
