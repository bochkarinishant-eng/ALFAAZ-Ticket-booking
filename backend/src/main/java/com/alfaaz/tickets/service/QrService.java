package com.alfaaz.tickets.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Map;

@Service
public class QrService {

    public byte[] pngBytes(String value) {
        try {
            BitMatrix matrix = new MultiFormatWriter().encode(
                value,
                BarcodeFormat.QR_CODE,
                380,
                380,
                Map.of(
                    EncodeHintType.MARGIN, 1,
                    EncodeHintType.CHARACTER_SET, "UTF-8"
                )
            );
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Unable to generate QR code bytes", e);
        }
    }

    public String pngBase64(String value) {
        return Base64.getEncoder().encodeToString(pngBytes(value));
    }
}
