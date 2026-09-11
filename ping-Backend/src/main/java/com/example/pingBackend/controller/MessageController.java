package com.example.pingBackend.controller;

import com.example.pingBackend.dto.response.ConversationMediaResponse;
import com.example.pingBackend.dto.response.MessageResponse;
import com.example.pingBackend.model.User;
import com.example.pingBackend.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations/{conversationId}/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    // Get message history (paginated)
    @GetMapping
    public ResponseEntity<Page<MessageResponse>> getMessages(
            @PathVariable String conversationId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal User currentUser
    ) {
        Page<MessageResponse> messages = messageService
                .getMessages(conversationId, currentUser.getId(), page, size);
        return ResponseEntity.ok(messages);
    }

    // Every file shared in this conversation — backs the Files panel, which
    // needs all of them rather than just the currently-loaded page of messages.
    @GetMapping("/media")
    public ResponseEntity<List<ConversationMediaResponse>> getConversationMedia(
            @PathVariable String conversationId,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(
                messageService.getConversationMedia(conversationId, currentUser.getId()));
    }

    // Mark messages as read
    @PutMapping("/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable String conversationId,
            @AuthenticationPrincipal User currentUser
    ) {
        messageService.markAsRead(conversationId, currentUser.getId());
        return ResponseEntity.ok().build();
    }
}