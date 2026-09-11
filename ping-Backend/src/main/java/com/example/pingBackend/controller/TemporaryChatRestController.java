package com.example.pingBackend.controller;

import com.example.pingBackend.dto.response.TemporaryChatInviteResponse;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.TemporaryConversationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The REST half of temporary chats. Proposing and responding happen over
 * WebSocket (TemporaryChatController) because both sides need to see the
 * result immediately; this is just the catch-up fetch for invites that
 * arrived while the recipient wasn't connected.
 */
@RestController
@RequestMapping("/api/temporary-chats")
@RequiredArgsConstructor
public class TemporaryChatRestController {

    private final TemporaryConversationService temporaryConversationService;

    @GetMapping("/invites/pending")
    public ResponseEntity<List<TemporaryChatInviteResponse>> getPendingInvites(
            @AuthenticationPrincipal User currentUser
    ) {
        // Scoped to the caller inside the service — there's no path here to
        // read someone else's invites.
        return ResponseEntity.ok(temporaryConversationService.getPendingInvites(currentUser.getId()));
    }
}
