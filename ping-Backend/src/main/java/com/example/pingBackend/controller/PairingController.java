package com.example.pingBackend.controller;

import com.example.pingBackend.exception.TooManyRequestsException;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.PairingService;
import com.example.pingBackend.service.RateLimiter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Map;

/**
 * The phone's side of QR sign-in (Stage 14). Needs you signed in: approving
 * means "sign that computer in as ME".
 *
 * The code travels in the request BODY, never the URL, so it doesn't end up
 * in server access logs or browser history.
 */
@RestController
@RequestMapping("/api/pairing")
@RequiredArgsConstructor
public class PairingController {

    private final PairingService pairingService;
    private final RateLimiter rateLimiter;

    @Data
    public static class CodeRequest {
        @NotBlank(message = "That isn't a Ping QR code")
        @Size(max = 100, message = "That isn't a Ping QR code")
        private String code;
    }

    @PostMapping("/lookup")
    public Map<String, String> lookup(@AuthenticationPrincipal User user, @Valid @RequestBody CodeRequest request) {
        limit(user);
        return Map.of("deviceName", pairingService.deviceFor(request.getCode()));
    }

    @PostMapping("/approve")
    public ResponseEntity<Void> approve(@AuthenticationPrincipal User user, @Valid @RequestBody CodeRequest request) {
        limit(user);
        pairingService.approve(request.getCode(), user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/deny")
    public ResponseEntity<Void> deny(@AuthenticationPrincipal User user, @Valid @RequestBody CodeRequest request) {
        limit(user);
        pairingService.deny(request.getCode());
        return ResponseEntity.noContent().build();
    }

    private void limit(User user) {
        if (!rateLimiter.tryAcquire("pairing:user:" + user.getId(), 30, Duration.ofMinutes(10))) {
            throw new TooManyRequestsException("Too many attempts. Please wait a few minutes.");
        }
    }
}
