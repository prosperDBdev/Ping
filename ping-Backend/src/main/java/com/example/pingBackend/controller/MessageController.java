package com.example.pingBackend.controller;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import jakarta.validation.Valid;
import com.example.pingBackend.dto.request.ReactionRequest;
import com.example.pingBackend.dto.request.EditMessageRequest;
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
    private final SimpMessagingTemplate messagingTemplate;

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
    /**
     * React to a message (or remove your reaction by sending it again).
     *
     * The updated message is broadcast on the conversation's existing live
     * channel, where every open copy of the chat replaces its old version. It
     * is deliberately NOT sent to anyone's inbox channel: a reaction isn't a
     * new message, so it mustn't mark the chat unread or trigger a pop-up.
     */
    @PutMapping("/{messageId}/reaction")
    public ResponseEntity<MessageResponse> react(
            @PathVariable String conversationId,
            @PathVariable String messageId,
            @Valid @RequestBody ReactionRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        MessageResponse updated = messageService.react(conversationId, messageId, currentUser.getId(), request.getEmoji());
        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, updated);
        return ResponseEntity.ok(updated);
    }

    /** Edit a message you sent in the last 10 minutes. Broadcast the same way. */
    @PatchMapping("/{messageId}")
    public ResponseEntity<MessageResponse> edit(
            @PathVariable String conversationId,
            @PathVariable String messageId,
            @Valid @RequestBody EditMessageRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        MessageResponse updated = messageService.edit(conversationId, messageId, currentUser.getId(), request.getContent());
        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, updated);
        return ResponseEntity.ok(updated);
    }

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