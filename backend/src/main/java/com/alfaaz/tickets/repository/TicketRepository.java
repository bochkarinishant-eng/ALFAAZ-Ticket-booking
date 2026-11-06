package com.alfaaz.tickets.repository;

import com.alfaaz.tickets.model.Ticket;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface TicketRepository extends JpaRepository<Ticket, Long> {
    Optional<Ticket> findByBookingId(Long bookingId);
    Optional<Ticket> findByBookingAccessKey(String accessKey);
    Optional<Ticket> findByTicketNumber(String ticketNumber);

    List<Ticket> findByEventIdOrderByCreatedAtDesc(Long eventId);

    long countByEventId(Long eventId);
    long countByEventIdAndStatus(Long eventId, String status);
    long countByEventIdAndAttendedTrue(Long eventId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Ticket t join fetch t.booking b join fetch t.event e where t.token = :token")
    Optional<Ticket> findByTokenForUpdate(@Param("token") String token);
}
