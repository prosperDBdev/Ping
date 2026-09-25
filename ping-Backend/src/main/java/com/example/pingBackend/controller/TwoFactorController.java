package com.example.pingBackend.controller;

import com.example.pingBackend.dto.request.LoginCodeRequest;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.LoginCodeService;
import com.example.pingBackend.service.TwoFactorService;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Two-step verification for YOUR OWN account. "me" in the path: there is no
 * way to name another user here.
 *
 *   POST /api/users/me/two-factor/start    email a code to switch it on
 *   POST /api/users/me/two-factor/confirm  enter that code; it's on
 *   POST /api/users/me/two-factor/disable  your password; it's off
 */
@RestController
@RequestMapping("/api/users/me/two-factor")
@RequiredArgsConstructor
public class TwoFactorController {

    private final TwoFactorService twoFactorService;

    @PostMapping("/start")
    public LoginCodeService.Issued start(@AuthenticationPrincipal User user) {
        return twoFactorService.start(user);
    }

    @PostMapping("/confirm")
    public ResponseEntity<Void> confirm(@AuthenticationPrincipal User user, @Valid @RequestBody LoginCodeRequest request) {
        twoFactorService.confirm(user, request.getChallenge(), request.getCode());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/disable")
    public ResponseEntity<Void> disable(@AuthenticationPrincipal User user, @RequestBody PasswordRequest request) {
        twoFactorService.disable(user, request.getPassword());
        return ResponseEntity.noContent().build();
    }

    @Data
    public static class PasswordRequest {
        private String password;
    }
}
