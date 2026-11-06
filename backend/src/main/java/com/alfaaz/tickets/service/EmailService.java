package com.alfaaz.tickets.service;

import com.alfaaz.tickets.model.Booking;
import com.alfaaz.tickets.model.Ticket;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    @Value("${app.cors.allowed-origin:http://localhost:5173}")
    private String baseUrl;

    public void sendBookingConfirmation(Booking booking, Ticket ticket) {
        String ticketUrl = baseUrl + "/?ticket=" + booking.getAccessKey();
        log.info("--------------------------------------------------");
        log.info("[ALFAAZ TICKET NOTIFICATION]");
        log.info("To: {} ({})", booking.getFullName(), booking.getEmail());
        log.info("Event: Alfaaz Open Mic - 9 Nov 2026, 5:00 PM");
        log.info("Ticket: {} (Type: {})", ticket.getTicketNumber(), booking.getTicketType());
        log.info("Attendee Link: {}", ticketUrl);
        log.info("--------------------------------------------------");

        if (mailSender == null || fromEmail == null || fromEmail.isBlank()) {
            log.info("SMTP configuration not enabled. Ticket email logged above. To send real emails, set spring.mail.* in application.properties.");
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(booking.getEmail());
            helper.setSubject("Your Alfaaz Open Mic Ticket is Confirmed! (Ref: " + booking.getBookingReference() + ")");

            String html = """
                <div style="font-family: serif, sans-serif; background: #fdfbf7; padding: 24px; color: #1c1618;">
                    <div style="max-width: 540px; margin: 0 auto; border: 2px solid #4a1521; padding: 24px; background: #fff;">
                        <h1 style="color: #4a1521; text-align: center; margin-bottom: 4px;">ALFAAZ OPEN MIC</h1>
                        <p style="text-align: center; color: #b83a4b; font-weight: bold; margin-top: 0;">YOUR VOICE. YOUR MOMENT.</p>
                        <hr style="border: none; border-top: 1px dashed #b83a4b; margin: 20px 0;" />
                        <p>Dear <strong>%s</strong>,</p>
                        <p>Your ticket has been verified and confirmed! You are officially part of Alfaaz Open Mic.</p>
                        <table style="width: 100%%; margin: 16px 0; font-size: 14px;">
                            <tr><td><strong>Event:</strong></td><td>Alfaaz Open Mic</td></tr>
                            <tr><td><strong>Date & Time:</strong></td><td>Monday, 9 November 2026 at 5:00 PM</td></tr>
                            <tr><td><strong>Venue:</strong></td><td>Beyond Temptation, Ashegaon Road, Basmat</td></tr>
                            <tr><td><strong>Ticket Number:</strong></td><td>%s</td></tr>
                            <tr><td><strong>Booking Reference:</strong></td><td>%s</td></tr>
                            <tr><td><strong>Pass Type:</strong></td><td>%s (₹%d)</td></tr>
                        </table>
                        <div style="text-align: center; margin: 24px 0;">
                            <a href="%s" style="background: #4a1521; color: #fff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">
                                View & Download Your Ticket
                            </a>
                        </div>
                        <p style="font-size: 12px; color: #666; text-align: center;">
                            Please present your unique QR code at the entrance for verification.<br/>
                            Helpline: +91 7020903320
                        </p>
                    </div>
                </div>
            """.formatted(
                booking.getFullName(),
                ticket.getTicketNumber(),
                booking.getBookingReference(),
                booking.getTicketType(),
                (int) booking.getAmount(),
                ticketUrl
            );

            helper.setText(html, true);
            mailSender.send(message);
            log.info("Confirmation email sent successfully to {}", booking.getEmail());
        } catch (Exception e) {
            log.error("Failed to send confirmation email to {}: {}", booking.getEmail(), e.getMessage());
        }
    }
}
