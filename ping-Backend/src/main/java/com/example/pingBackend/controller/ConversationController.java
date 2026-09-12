package com.example.pingBackend.controller;

import com.example.pingBackend.dto.request.CreateConversationRequest;
import com.example.pingBackend.dto.request.CreateGroupRequest;
import com.example.pingBackend.dto.response.ConversationResponse;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.ConversationService;
import com.example.pingBackend.service.MessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;
    private final MessageService messageService;

    // Create or get existing private conversation
    @PostMapping("/private")
    public ResponseEntity<ConversationResponse> createPrivateConversation(
            @Valid @RequestBody CreateConversationRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        ConversationResponse response = conversationService
                .createPrivateConversation(currentUser.getId(), request.getParticipantId());
        return ResponseEntity.ok(response);
    }

    /**
     * Create a group conversation.
     *
     * The literal "/group" and the "/{id}" mapping below both match a POST to
     * /api/conversations/group. Spring resolves that in favour of the literal
     * segment, so this wins — but it's worth knowing the collision is there.
     * Until this method existed, the request fell through to @GetMapping("/{id}")
     * with id="group", which is why the browser saw 405 Method Not Allowed
     * rather than 404: the path matched something, just not for POST.
     */
    @PostMapping("/group")
    public ResponseEntity<ConversationResponse> createGroupConversation(
            @Valid @RequestBody CreateGroupRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        ConversationResponse response = conversationService.createGroupConversation(
                currentUser.getId(), request.getName(), request.getParticipantIds());
        return ResponseEntity.ok(response);
    }

    // Get all conversations for the current user
    @GetMapping
    public ResponseEntity<List<ConversationResponse>> getUserConversations(
            @AuthenticationPrincipal User currentUser
    ) {
        List<ConversationResponse> conversations = conversationService
                .getUserConversations(currentUser.getId());
        return ResponseEntity.ok(conversations);
    }

    // Get a specific conversation
    @GetMapping("/{id}")
    public ResponseEntity<ConversationResponse> getConversation(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser
    ) {
        ConversationResponse response = conversationService
                .getConversation(id, currentUser.getId());
        return ResponseEntity.ok(response);
    }

    /**
     * Clear this conversation for the calling user only.
     *
     * DELETE on /clear rather than on the conversation itself, because nothing
     * is actually deleted — the conversation and the other person's copy of
     * every message stay exactly where they were.
     */
    @DeleteMapping("/{id}/clear")
    public ResponseEntity<Void> clearConversation(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser
    ) {
        messageService.clearConversation(id, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    /** Remove a member from a group. Admin only — enforced in the service. */
    @DeleteMapping("/{id}/participants/{userId}")
    public ResponseEntity<Void> removeParticipant(
            @PathVariable String id,
            @PathVariable String userId,
            @AuthenticationPrincipal User currentUser
    ) {
        conversationService.removeParticipant(id, currentUser.getId(), userId);
        return ResponseEntity.noContent().build();
    }
}