package com.alfaaz.tickets.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tickets", indexes = {
    @Index(name = "idx_ticket_token", columnList = "token", unique = true),
    @Index(name = "idx_ticket_number", columnList = "ticketNumber", unique = true),
    @Index(name = "idx_ticket_status", columnList = "status")
})
public class Ticket {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "booking_id", nullable = false, unique = true)
    private Booking booking;

    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    private Event event;

    @Column(length = 255)
    private String buyerName;

    @Column(length = 255)
    private String buyerPhone;

    @Column(length = 255)
    private String ticketType;

    @Column(nullable = false, unique = true, length = 32)
    private String ticketNumber;

    @Column(nullable = false, unique = true, length = 128)
    private String token;

    @Column(nullable = false, length = 30)
    private String status = "VALID"; // VALID, USED, CANCELLED

    @Column(nullable = false)
    private boolean attended = false;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime checkedInAt;

    public Ticket() {}

    public Ticket(Booking booking, Event event, String ticketNumber, String token) {
        this.booking = booking;
        this.event = event;
        this.ticketNumber = ticketNumber;
        this.token = token;
        this.buyerName = booking.getFullName();
        this.buyerPhone = booking.getMobile();
        this.ticketType = booking.getTicketType();
        this.status = "VALID";
        this.attended = false;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Booking getBooking() { return booking; }
    public void setBooking(Booking booking) { this.booking = booking; }
    public Event getEvent() { return event; }
    public void setEvent(Event event) { this.event = event; }
    public String getBuyerName() { return buyerName; }
    public void setBuyerName(String buyerName) { this.buyerName = buyerName; }
    public String getBuyerPhone() { return buyerPhone; }
    public void setBuyerPhone(String buyerPhone) { this.buyerPhone = buyerPhone; }
    public String getTicketType() { return ticketType; }
    public void setTicketType(String ticketType) { this.ticketType = ticketType; }
    public String getTicketNumber() { return ticketNumber; }
    public void setTicketNumber(String ticketNumber) { this.ticketNumber = ticketNumber; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public boolean isAttended() { return attended; }
    public void setAttended(boolean attended) { this.attended = attended; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getCheckedInAt() { return checkedInAt; }
    public void setCheckedInAt(LocalDateTime checkedInAt) { this.checkedInAt = checkedInAt; }
}
