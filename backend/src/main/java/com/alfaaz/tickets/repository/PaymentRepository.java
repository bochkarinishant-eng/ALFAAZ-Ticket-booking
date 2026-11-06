package com.alfaaz.tickets.repository;

import com.alfaaz.tickets.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByBookingId(Long bookingId);
    Optional<Payment> findByBookingBookingReference(String bookingReference);
    Optional<Payment> findByUtrNumber(String utrNumber);

    List<Payment> findByStatusOrderBySubmittedAtDesc(String status);

    long countByStatus(String status);

    @Query("select p from Payment p where p.booking.event.id = :eventId order by p.createdAt desc")
    List<Payment> findByEventIdOrderByCreatedAtDesc(@Param("eventId") Long eventId);
}
