package com.alfaaz.tickets.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "events")
public class Event {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title = "Alfaaz Open Mic";

    @Column(nullable = false)
    private String organizer = "Alfaaz";

    @Column(nullable = false)
    private LocalDateTime eventDateTime;

    @Column(nullable = false)
    private String venue;

    @Column(nullable = false)
    private int maxCapacity = 40;

    @Column(nullable = false)
    private double audiencePrice = 100.0;

    @Column(nullable = false)
    private double performerPrice = 100.0;

    @Column(nullable = false)
    private String contactPhone = "8624890246";

    @Column(nullable = false)
    private String upiId = "8624890246@ibl";

    @Column(nullable = false)
    private boolean active = true;

    public Event() {}

    public Event(String title, LocalDateTime eventDateTime, String venue) {
        this.title = title;
        this.eventDateTime = eventDateTime;
        this.venue = venue;
        this.organizer = "Alfaaz";
        this.maxCapacity = 40;
        this.audiencePrice = 100.0;
        this.performerPrice = 100.0;
        this.contactPhone = "8624890246";
        this.upiId = "8624890246@ibl";
        this.active = true;
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getOrganizer() { return organizer; }
    public void setOrganizer(String organizer) { this.organizer = organizer; }
    public LocalDateTime getEventDateTime() { return eventDateTime; }
    public void setEventDateTime(LocalDateTime eventDateTime) { this.eventDateTime = eventDateTime; }
    public String getVenue() { return venue; }
    public void setVenue(String venue) { this.venue = venue; }
    public int getMaxCapacity() { return maxCapacity; }
    public void setMaxCapacity(int maxCapacity) { this.maxCapacity = maxCapacity; }
    public double getAudiencePrice() { return audiencePrice; }
    public void setAudiencePrice(double audiencePrice) { this.audiencePrice = audiencePrice; }
    public double getPerformerPrice() { return performerPrice; }
    public void setPerformerPrice(double performerPrice) { this.performerPrice = performerPrice; }
    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
    public String getUpiId() { return upiId; }
    public void setUpiId(String upiId) { this.upiId = upiId; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
