package com.alfaaz.tickets.repository;

import com.alfaaz.tickets.model.CheckIn;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CheckInRepository extends JpaRepository<CheckIn, Long> {
    List<CheckIn> findTop50ByOrderByScannedAtDesc();
    long countByResult(String result);
}
