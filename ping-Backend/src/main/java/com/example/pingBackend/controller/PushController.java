package com.example.pingBackend.controller;

import com.example.pingBackend.model.User;
import com.example.pingBackend.service.PushService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import com.example.pingBackend.exception.TooManyRequestsException;
import com.example.pingBackend.service.RateLimiter;
import java.time.Duration;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Registering devices for push notifications. Every endpoint requires a
 * signed-in user (SecurityConfig denies by default), and a device is always
 * registered to the caller: there is no user id in any request.
 */
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final PushService pushService;
    private final RateLimiter rateLimiter;

    /** The server's public key, which the browser needs to subscribe. Null when push is off. */
    @GetMapping("/public-key")
    public PublicKeyResponse publicKey() {
        return new PublicKeyResponse(pushService.publicKey());
    }

    @PostMapping("/subscriptions")
    public ResponseEntity<Void> subscribe(@Valid @RequestBody SubscribeRequest request,
                                          @AuthenticationPrincipal User currentUser) {
        pushService.subscribe(currentUser.getId(), request.getEndpoint(), request.getP256dh(), request.getAuth());
        return ResponseEntity.noContent().build();
    }

    /**
     * Send yourself a test notification. Limited to 10 an hour: it's a way to
     * check a phone's settings, not a way to make a phone buzz on demand.
     */
    @PostMapping("/test")
    public Map<String, Object> test(@AuthenticationPrincipal User currentUser) {
        if (!rateLimiter.tryAcquire("push-test:user:" + currentUser.getId(), 10, Duration.ofHours(1))) {
            throw new TooManyRequestsException("You've sent a few tests already. Try again in a while.");
        }
        return Map.of("enabled", pushService.enabled(), "devices", pushService.sendTest(currentUser.getId()));
    }

    @DeleteMapping("/subscriptions")
    public ResponseEntity<Void> unsubscribe(@Valid @RequestBody UnsubscribeRequest request,
                                            @AuthenticationPrincipal User currentUser) {
        pushService.unsubscribe(currentUser.getId(), request.getEndpoint());
        return ResponseEntity.noContent().build();
    }

    public record PublicKeyResponse(String publicKey) {
    }

    /** Sizes only; whether it's a real push service is decided in PushService. */
    @Data
    public static class SubscribeRequest {
        @NotBlank @Size(max = 1000)
        private String endpoint;
        @NotBlank @Size(max = 200)
        private String p256dh;
        @NotBlank @Size(max = 100)
        private String auth;
    }

    @Data
    public static class UnsubscribeRequest {
        @NotBlank @Size(max = 1000)
        private String endpoint;
    }
}
