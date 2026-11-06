package com.alfaaz.tickets.repository;

import com.alfaaz.tickets.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {
    Optional<Booking> findByBookingReference(String bookingReference);
    Optional<Booking> findByAccessKey(String accessKey);
    List<Booking> findByMobileContainingOrderByCreatedAtDesc(String mobile);

    List<Booking> findByEventIdOrderByCreatedAtDesc(Long eventId);

    long countByEventIdAndStatus(Long eventId, String status);

    long countByEventIdAndTicketTypeAndStatus(Long eventId, String ticketType, String status);

    @Query("select count(b) from Booking b where b.event.id = :eventId and b.status in ('PENDING', 'SUBMITTED') and b.reservedUntil > :now")
    long countActivePendingReservations(@Param("eventId") Long eventId, @Param("now") LocalDateTime now);

    @Query("select b from Booking b where b.status = 'PENDING' and b.reservedUntil <= :now")
    List<Booking> findExpiredReservations(@Param("now") LocalDateTime now);

    @Query("select b from Booking b where b.event.id = :eventId and (" +
           "lower(b.fullName) like lower(concat('%', :q, '%')) or " +
           "lower(b.mobile) like lower(concat('%', :q, '%')) or " +
           "lower(b.email) like lower(concat('%', :q, '%')) or " +
           "lower(b.bookingReference) like lower(concat('%', :q, '%'))" +
           ") order by b.createdAt desc")
    List<Booking> searchBookings(@Param("eventId") Long eventId, @Param("q") String q);
}
