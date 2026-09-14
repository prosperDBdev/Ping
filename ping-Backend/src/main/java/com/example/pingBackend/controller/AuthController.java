package com.example.pingBackend.controller;

import com.example.pingBackend.dto.request.ForgotPasswordRequest;
import com.example.pingBackend.dto.request.LoginRequest;
import com.example.pingBackend.dto.request.RegisterRequest;
import com.example.pingBackend.dto.request.ResetPasswordRequest;
import com.example.pingBackend.dto.response.AuthResponse;
import com.example.pingBackend.service.AuthService;
import com.example.pingBackend.service.PasswordResetService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Always answers the same way, whether or not the email has an account —
     * see PasswordResetService.requestReset for why.
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request,
            HttpServletRequest http
    ) {
        passwordResetService.requestReset(request.getEmail(), clientIp(http));
        return ResponseEntity.ok(Map.of(
                "message", "If an account exists for that email, we've sent a link to reset your password."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request,
            HttpServletRequest http
    ) {
        passwordResetService.resetPassword(request.getToken(), request.getNewPassword(), clientIp(http));
        return ResponseEntity.ok(Map.of("message", "Password changed. Sign in with your new password."));
    }

    /**
     * The caller's IP address, for per-IP rate limits.
     *
     * getRemoteAddr is the address that actually connected to this server. That's
     * right locally. Behind a hosting platform's proxy (Render, for instance) it
     * would be the PROXY's address for every user — so everyone would share one
     * rate limit. The real address then arrives in the X-Forwarded-For header,
     * but that header must only be trusted from the proxy: anyone can send it,
     * and a limiter that believes it can be dodged by making up a new IP on every
     * request. When deploying, set server.forward-headers-strategy=native so the
     * server resolves this from the trusted proxy rather than trusting the header
     * directly.
     */
    private static String clientIp(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}
