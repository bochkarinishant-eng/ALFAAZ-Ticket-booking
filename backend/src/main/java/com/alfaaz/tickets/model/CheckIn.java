package com.alfaaz.tickets.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "check_ins")
public class CheckIn {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id")
    private Ticket ticket;

    @Column(nullable = false, length = 128)
    private String tokenScanned;

    @Column(nullable = false, length = 50)
    private String result;

    @Column(length = 255)
    private String attendeeName;

    @Column(nullable = false)
    private LocalDateTime scannedAt = LocalDateTime.now();

    public CheckIn() {}

    public CheckIn(Ticket ticket, String tokenScanned, String result, String attendeeName) {
        this.ticket = ticket;
        this.tokenScanned = tokenScanned;
        this.result = result;
        this.attendeeName = attendeeName;
        this.scannedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Ticket getTicket() { return ticket; }
    public String getTokenScanned() { return tokenScanned; }
    public String getResult() { return result; }
    public String getAttendeeName() { return attendeeName; }
    public LocalDateTime getScannedAt() { return scannedAt; }
}
