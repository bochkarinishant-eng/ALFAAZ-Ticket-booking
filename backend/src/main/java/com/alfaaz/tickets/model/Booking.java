package com.alfaaz.tickets.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "bookings", indexes = {
    @Index(name = "idx_booking_ref", columnList = "bookingReference", unique = true),
    @Index(name = "idx_booking_access_key", columnList = "accessKey", unique = true),
    @Index(name = "idx_booking_status", columnList = "status")
})
public class Booking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 32)
    private String bookingReference;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    private Event event;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false, length = 20)
    private String mobile;

    @Column(length = 100)
    private String email;

    @Column(nullable = false, length = 30)
    private String ticketType; // "Audience" or "Performer"

    @Column(length = 50)
    private String performerCategory; // "Poetry", "Music", "Comedy", "Storytelling", "Other"

    @Column(length = 1000)
    private String performanceDescription;

    @Column(nullable = false)
    private double amount = 100.0;

    @Column(nullable = false, length = 30)
    private String status = "PENDING"; // PENDING, SUBMITTED, CONFIRMED, CANCELLED, REJECTED, EXPIRED

    @Column(nullable = false)
    private LocalDateTime reservedUntil;

    @Column(nullable = false, unique = true, length = 64)
    private String accessKey;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt = LocalDateTime.now();

    public Booking() {}

    public Booking(Event event, String bookingReference, String fullName, String mobile, String email,
                   String ticketType, String performerCategory, String performanceDescription,
                   double amount, LocalDateTime reservedUntil, String accessKey) {
        this.event = event;
        this.bookingReference = bookingReference;
        this.fullName = fullName;
        this.mobile = mobile;
        this.email = email;
        this.ticketType = ticketType;
        this.performerCategory = performerCategory;
        this.performanceDescription = performanceDescription;
        this.amount = amount;
        this.status = "PENDING";
        this.reservedUntil = reservedUntil;
        this.accessKey = accessKey;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getBookingReference() { return bookingReference; }
    public void setBookingReference(String bookingReference) { this.bookingReference = bookingReference; }
    public Event getEvent() { return event; }
    public void setEvent(Event event) { this.event = event; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getMobile() { return mobile; }
    public void setMobile(String mobile) { this.mobile = mobile; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getTicketType() { return ticketType; }
    public void setTicketType(String ticketType) { this.ticketType = ticketType; }
    public String getPerformerCategory() { return performerCategory; }
    public void setPerformerCategory(String performerCategory) { this.performerCategory = performerCategory; }
    public String getPerformanceDescription() { return performanceDescription; }
    public void setPerformanceDescription(String performanceDescription) { this.performanceDescription = performanceDescription; }
    public double getAmount() { return amount; }
    public void setAmount(double amount) { this.amount = amount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; this.updatedAt = LocalDateTime.now(); }
    public LocalDateTime getReservedUntil() { return reservedUntil; }
    public void setReservedUntil(LocalDateTime reservedUntil) { this.reservedUntil = reservedUntil; }
    public String getAccessKey() { return accessKey; }
    public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
