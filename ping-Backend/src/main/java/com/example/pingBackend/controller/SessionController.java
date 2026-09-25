package com.example.pingBackend.controller;

import com.example.pingBackend.model.LoginSession;
import com.example.pingBackend.model.User;
import com.example.pingBackend.security.CurrentSession;
import com.example.pingBackend.service.SessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Your signed-in devices (Stage 14).
 *
 *   GET    /api/sessions          the list, with "this device" marked
 *   DELETE /api/sessions/current  sign out here (what "Log out" calls)
 *   DELETE /api/sessions/others   sign out everywhere else
 *   DELETE /api/sessions/{id}     sign out one device
 *
 * Every one of them only ever sees or touches the caller's own sessions.
 */
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {

    private final SessionService sessionService;

    /** What the device list shows. No token, no user id: nothing to reuse. */
    public record DeviceResponse(String id, String deviceName, String method,
                                 LocalDateTime createdAt, LocalDateTime lastActiveAt, boolean current) {
    }

    @GetMapping
    public List<DeviceResponse> list(@AuthenticationPrincipal User user,
                                     @RequestAttribute(CurrentSession.ATTRIBUTE) String currentId) {
        return sessionService.list(user.getId()).stream()
                .map(s -> toResponse(s, currentId))
                // This device first, then most recently active.
                .sorted((a, b) -> Boolean.compare(b.current(), a.current()))
                .toList();
    }

    @DeleteMapping("/current")
    public ResponseEntity<Void> signOutHere(@AuthenticationPrincipal User user,
                                            @RequestAttribute(CurrentSession.ATTRIBUTE) String currentId) {
        sessionService.revoke(user.getId(), currentId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/others")
    public Map<String, Integer> signOutOthers(@AuthenticationPrincipal User user,
                                              @RequestAttribute(CurrentSession.ATTRIBUTE) String currentId) {
        return Map.of("signedOut", sessionService.revokeOthers(user.getId(), currentId));
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> signOut(@AuthenticationPrincipal User user, @PathVariable String sessionId) {
        sessionService.revoke(user.getId(), sessionId);
        return ResponseEntity.noContent().build();
    }

    private static DeviceResponse toResponse(LoginSession s, String currentId) {
        return new DeviceResponse(s.getId(), s.getDeviceName(), s.getMethod(),
                s.getCreatedAt(), s.getLastActiveAt(), s.getId().equals(currentId));
    }
}
