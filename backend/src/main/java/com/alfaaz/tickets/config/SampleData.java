package com.alfaaz.tickets.config;

import com.alfaaz.tickets.model.Event;
import com.alfaaz.tickets.repository.EventRepository;
import com.alfaaz.tickets.service.AdminAuthService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;

@Configuration
public class SampleData {

    @Bean
    CommandLineRunner seedData(EventRepository events, AdminAuthService adminAuth) {
        return args -> {
            adminAuth.initDefaultAdmin();

            if (events.count() == 0) {
                Event ev = new Event(
                    "Alfaaz Open Mic",
                    LocalDateTime.of(2026, 11, 9, 17, 0),
                    "Beyond Temptation, Ashegaon Road, Basmat"
                );
                ev.setOrganizer("Alfaaz");
                ev.setMaxCapacity(99999);
                ev.setAudiencePrice(100.0);
                ev.setPerformerPrice(100.0);
                ev.setContactPhone("8624890246");
                ev.setUpiId("8624890246@ibl");
                events.save(ev);
            } else {
                Event ev = events.findAll().get(0);
                ev.setTitle("Alfaaz Open Mic");
                ev.setOrganizer("Alfaaz");
                ev.setEventDateTime(LocalDateTime.of(2026, 11, 9, 17, 0));
                ev.setVenue("Beyond Temptation, Ashegaon Road, Basmat");
                ev.setMaxCapacity(99999);
                ev.setAudiencePrice(100.0);
                ev.setPerformerPrice(100.0);
                ev.setContactPhone("8624890246");
                ev.setUpiId("8624890246@ibl");
                events.save(ev);
            }
        };
    }
}
