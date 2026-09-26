package com.example.pingBackend.controller;

import com.example.pingBackend.model.User;
import com.example.pingBackend.service.PinService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Shared pinned messages.
 *
 *   GET    /api/conversations/{cid}/pins
 *   PUT    /api/conversations/{cid}/messages/{mid}/pin
 *   DELETE /api/conversations/{cid}/messages/{mid}/pin
 */
@RestController
@RequestMapping("/api/conversations/{conversationId}")
@RequiredArgsConstructor
public class PinController {

    private final PinService pinService;

    @GetMapping("/pins")
    public List<PinService.PinResponse> list(@PathVariable String conversationId, @AuthenticationPrincipal User me) {
        return pinService.list(conversationId, me.getId());
    }

    @PutMapping("/messages/{messageId}/pin")
    public ResponseEntity<Void> pin(@PathVariable String conversationId, @PathVariable String messageId,
                                    @AuthenticationPrincipal User me) {
        pinService.pin(conversationId, messageId, me);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/messages/{messageId}/pin")
    public ResponseEntity<Void> unpin(@PathVariable String conversationId, @PathVariable String messageId,
                                      @AuthenticationPrincipal User me) {
        pinService.unpin(conversationId, messageId, me);
        return ResponseEntity.noContent().build();
    }
}
