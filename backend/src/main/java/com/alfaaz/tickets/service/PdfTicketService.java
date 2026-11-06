package com.alfaaz.tickets.service;

import com.alfaaz.tickets.model.Booking;
import com.alfaaz.tickets.model.Ticket;
import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;

@Service
public class PdfTicketService {
    private final QrService qrService;

    public PdfTicketService(QrService qrService) {
        this.qrService = qrService;
    }

    public byte[] generateTicketPdf(Ticket ticket) {
        Booking booking = ticket.getBooking();
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        // Custom ticket size: width 540pt, height 720pt (approx 7.5 x 10 in)
        Rectangle pageSize = new Rectangle(540, 720);
        Document document = new Document(pageSize, 30, 30, 30, 30);

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Color deepMaroon = new Color(74, 21, 33);
            Color accentRed = new Color(184, 58, 75);
            Color charcoal = new Color(28, 22, 24);
            Color creamBg = new Color(251, 247, 238);
            Color mutedText = new Color(105, 95, 95);

            Font brandFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 26, deepMaroon);
            Font tagFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, accentRed);
            Font headerTitleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, deepMaroon);
            Font labelFont = FontFactory.getFont(FontFactory.HELVETICA, 9, mutedText);
            Font valueFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, charcoal);
            Font largeValueFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15, deepMaroon);
            Font smallFont = FontFactory.getFont(FontFactory.HELVETICA, 8, mutedText);

            // Outer Ticket Border Table
            PdfPTable card = new PdfPTable(1);
            card.setWidthPercentage(100);

            PdfPCell cardCell = new PdfPCell();
            cardCell.setBackgroundColor(creamBg);
            cardCell.setBorderColor(deepMaroon);
            cardCell.setBorderWidth(2f);
            cardCell.setPadding(24f);

            // --- HEADER ---
            Paragraph brandPara = new Paragraph("ALFAAZ", brandFont);
            brandPara.setAlignment(Element.ALIGN_CENTER);
            cardCell.addElement(brandPara);

            Paragraph subBrand = new Paragraph("YOUR VOICE · YOUR MOMENT · OPEN MIC", tagFont);
            subBrand.setAlignment(Element.ALIGN_CENTER);
            subBrand.setSpacingAfter(12f);
            cardCell.addElement(subBrand);

            // Thin Divider line
            Paragraph div = new Paragraph("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", FontFactory.getFont(FontFactory.HELVETICA, 10, accentRed));
            div.setAlignment(Element.ALIGN_CENTER);
            div.setSpacingAfter(14f);
            cardCell.addElement(div);

            // --- TWO COLUMN SECTION: DETAILS + QR ---
            PdfPTable bodyTable = new PdfPTable(2);
            bodyTable.setWidthPercentage(100);
            bodyTable.setWidths(new float[]{62f, 38f});

            // Left: Event & Attendee details
            PdfPCell leftCell = new PdfPCell();
            leftCell.setBorder(Rectangle.NO_BORDER);
            leftCell.setPaddingRight(12f);

            leftCell.addElement(new Paragraph("EVENT", labelFont));
            leftCell.addElement(new Paragraph("Alfaaz Open Mic — 2026", headerTitleFont));
            leftCell.addElement(new Paragraph(" "));

            leftCell.addElement(new Paragraph("ATTENDEE NAME", labelFont));
            leftCell.addElement(new Paragraph(booking.getFullName(), largeValueFont));
            leftCell.addElement(new Paragraph(" "));

            leftCell.addElement(new Paragraph("TICKET TYPE", labelFont));
            String typeBadge = booking.getTicketType().toUpperCase() + " PASS (₹" + (int)booking.getAmount() + ")";
            leftCell.addElement(new Paragraph(typeBadge, valueFont));

            if ("Performer".equalsIgnoreCase(booking.getTicketType()) && booking.getPerformerCategory() != null) {
                leftCell.addElement(new Paragraph(" "));
                leftCell.addElement(new Paragraph("PERFORMANCE GENRE", labelFont));
                leftCell.addElement(new Paragraph(booking.getPerformerCategory() + 
                    (booking.getPerformanceDescription() != null && !booking.getPerformanceDescription().isBlank()
                        ? " — " + booking.getPerformanceDescription() : ""), valueFont));
            }

            leftCell.addElement(new Paragraph(" "));
            leftCell.addElement(new Paragraph("DATE & TIME", labelFont));
            DateTimeFormatter dtf = DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy · h:mm a", java.util.Locale.ENGLISH);
            leftCell.addElement(new Paragraph(ticket.getEvent().getEventDateTime().format(dtf), valueFont));
            leftCell.addElement(new Paragraph(" "));

            leftCell.addElement(new Paragraph("VENUE", labelFont));
            leftCell.addElement(new Paragraph(ticket.getEvent().getVenue(), valueFont));
            leftCell.addElement(new Paragraph(" "));

            leftCell.addElement(new Paragraph("BOOKING REF / TICKET ID", labelFont));
            leftCell.addElement(new Paragraph(booking.getBookingReference() + "  |  " + ticket.getTicketNumber(), valueFont));

            bodyTable.addCell(leftCell);

            // Right: QR Code & Status
            PdfPCell rightCell = new PdfPCell();
            rightCell.setBorder(Rectangle.NO_BORDER);
            rightCell.setHorizontalAlignment(Element.ALIGN_CENTER);

            // Embed QR Code
            byte[] qrBytes = qrService.pngBytes(ticket.getToken());
            Image qrImage = Image.getInstance(qrBytes);
            qrImage.scaleToFit(160, 160);
            qrImage.setAlignment(Element.ALIGN_CENTER);
            rightCell.addElement(qrImage);

            Paragraph qrNotice = new Paragraph("SCAN FOR ENTRY", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, deepMaroon));
            qrNotice.setAlignment(Element.ALIGN_CENTER);
            qrNotice.setSpacingBefore(6f);
            rightCell.addElement(qrNotice);

            Paragraph statusPara = new Paragraph("STATUS: CONFIRMED & VERIFIED", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, new Color(24, 120, 50)));
            statusPara.setAlignment(Element.ALIGN_CENTER);
            statusPara.setSpacingBefore(4f);
            rightCell.addElement(statusPara);

            Paragraph refPara = new Paragraph("Ref: " + booking.getBookingReference(), smallFont);
            refPara.setAlignment(Element.ALIGN_CENTER);
            rightCell.addElement(refPara);

            bodyTable.addCell(rightCell);
            cardCell.addElement(bodyTable);

            // --- FOOTER NOTICE ---
            cardCell.addElement(new Paragraph(" "));
            Paragraph termsTitle = new Paragraph("ENTRY GUIDELINES & TERMS", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, deepMaroon));
            termsTitle.setSpacingBefore(10f);
            cardCell.addElement(termsTitle);

            Paragraph termsText = new Paragraph(
                "• Strict single-entry pass. Once scanned at the door, this QR code is permanently marked as USED.\n" +
                "• Strictly limited to 40 seated attendees. Please arrive 15 minutes prior to 5:00 PM for verification.\n" +
                "• For queries or assistance, contact organizer Alfaaz: +91 8624890246 / Beyond Temptation, Basmat.",
                smallFont
            );
            termsText.setSpacingAfter(8f);
            cardCell.addElement(termsText);

            card.addCell(cardCell);
            document.add(card);
            document.close();

            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate PDF ticket", e);
        }
    }
}
