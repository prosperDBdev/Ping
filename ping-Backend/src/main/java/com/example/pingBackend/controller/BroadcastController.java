package com.example.pingBackend.controller;

import com.example.pingBackend.service.BroadcastService;
import com.example.pingBackend.service.BroadcastService.BroadcastResult;
import com.example.pingBackend.service.EmailService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/broadcast")
@RequiredArgsConstructor
public class BroadcastController {

    private final BroadcastService broadcastService;
    private final EmailService emailService;

    @Data
    public static class BroadcastRequest {
        private String subject;
        private String customMessage;
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus() {
        return ResponseEntity.ok(Map.of(
                "emailConfigured", emailService.isConfigured(),
                "status", emailService.isConfigured() ? "READY" : "BREVO_NOT_CONFIGURED"
        ));
    }

    @PostMapping("/send")
    public ResponseEntity<BroadcastResult> sendBroadcast(@RequestBody(required = false) BroadcastRequest request) {
        String subject = request != null ? request.getSubject() : null;
        String message = request != null ? request.getCustomMessage() : null;

        BroadcastResult result = broadcastService.sendBroadcast(subject, message);
        return ResponseEntity.ok(result);
    }
}
