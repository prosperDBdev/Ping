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
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        AuthResponse response = authService.login(request, clientIp(http));
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
     * The caller's real IP address, for per-IP rate limits.
     *
     * With server.forward-headers-strategy=native (application.properties),
     * getRemoteAddr already accounts for a hosting platform's proxy: Tomcat reads
     * X-Forwarded-For, but ONLY when the connection comes from a trusted internal
     * proxy address. That condition is the security. X-Forwarded-For is just a
     * header, and anyone can send one — a limiter that believed it from anywhere
     * could be dodged by inventing a new IP on every request. Trusted only from the
     * load balancer, it can't be forged by the client.
     *
     * Deliberately not reading the header here directly — that would bypass the
     * trust check and bring the forgery problem straight back.
     */
    private static String clientIp(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}
