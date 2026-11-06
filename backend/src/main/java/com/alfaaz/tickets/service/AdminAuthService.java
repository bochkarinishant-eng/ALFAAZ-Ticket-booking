package com.alfaaz.tickets.service;

import com.alfaaz.tickets.dto.ApiDtos.*;
import com.alfaaz.tickets.model.AdminUser;
import com.alfaaz.tickets.repository.AdminUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AdminAuthService {

    private final AdminUserRepository adminUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom random = new SecureRandom();

    // In-memory token store: token -> AdminSession
    private final Map<String, AdminSession> activeSessions = new ConcurrentHashMap<>();

    @Value("${app.admin.username:admin}")
    private String defaultUsername;

    @Value("${app.admin.password:Alfaaz@2026}")
    private String defaultPassword;

    public AdminAuthService(AdminUserRepository adminUserRepository, PasswordEncoder passwordEncoder) {
        this.adminUserRepository = adminUserRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public void initDefaultAdmin() {
        if (!adminUserRepository.existsByUsername(defaultUsername)) {
            String hash = passwordEncoder.encode(defaultPassword);
            adminUserRepository.save(new AdminUser(defaultUsername, hash, "ADMIN"));
        }
    }

    public AdminLoginResponse login(AdminLoginRequest req) {
        String username = req.username().trim();
        AdminUser admin = adminUserRepository.findByUsername(username).orElse(null);

        if (admin == null || !passwordEncoder.matches(req.password(), admin.getPasswordHash())) {
            return new AdminLoginResponse(false, null, null, null, "Invalid username or password");
        }

        byte[] tokenBytes = new byte[32];
        random.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);

        activeSessions.put(token, new AdminSession(admin.getUsername(), admin.getRole(), LocalDateTime.now().plusDays(7)));

        return new AdminLoginResponse(true, token, admin.getUsername(), admin.getRole(), "Login successful");
    }

    public boolean validateToken(String token) {
        if (token == null || token.isBlank()) return false;
        AdminSession session = activeSessions.get(token.trim());
        if (session == null) return false;
        if (session.expiresAt().isBefore(LocalDateTime.now())) {
            activeSessions.remove(token.trim());
            return false;
        }
        return true;
    }

    public void logout(String token) {
        if (token != null) activeSessions.remove(token.trim());
    }

    public record AdminSession(String username, String role, LocalDateTime expiresAt) {}
}
