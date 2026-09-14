package com.example.pingBackend.controller;

import com.example.pingBackend.dto.request.SendMessageRequest;
import com.example.pingBackend.dto.response.MessageResponse;
import com.example.pingBackend.model.Message;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.UserRepository;
import com.example.pingBackend.security.WebSocketIdentity;
import com.example.pingBackend.service.PresenceService;
import com.example.pingBackend.service.MessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageService messageService;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final PresenceService presenceService;

    // Handle incoming chat messages
    @MessageMapping("/chat.send")
    public void sendMessage(@Payload SendMessageRequest request, SimpMessageHeaderAccessor headerAccessor) {

        // Identity comes from the token verified at CONNECT (see
        // StompAuthChannelInterceptor) — never from anything inside the message.
        String userId = WebSocketIdentity.userIdOf(headerAccessor.getUser());

        if (userId == null) {
            log.warn("Message from unauthenticated session: {}", headerAccessor.getSessionId());
            return;
        }

        User sender = userRepository.findById(userId).orElse(null);
        if (sender == null) return;

        // Build the attachment reference, if this message carries one (voice notes, etc.)
        Message.Attachment attachment = null;
        if (request.getAttachmentKey() != null) {
            attachment = Message.Attachment.builder()
                    .key(request.getAttachmentKey())
                    .mimeType(request.getAttachmentMimeType())
                    .sizeBytes(request.getAttachmentSizeBytes() != null ? request.getAttachmentSizeBytes() : 0)
                    .durationSeconds(request.getAttachmentDurationSeconds())
                    .fileName(request.getAttachmentFileName())
                    .build();
        }

        // Save the message
        MessageResponse savedMessage = messageService.saveMessage(
                request.getConversationId(),
                sender.getId(),
                sender.getUsername(),
                request.getContent(),
                request.getType(),
                attachment
        );

        // Broadcast to the conversation topic — this only reaches clients that
        // currently have this specific conversation open.
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + request.getConversationId(),
                savedMessage
        );

        // Also notify every participant on their own inbox topic, which they
        // stay subscribed to for the whole session. Without this, a message
        // arriving in a conversation you don't have open updates nothing —
        // no sidebar preview, no unread badge — because the only subscription
        // carrying it was the per-conversation one for the chat on screen.
        conversationRepository.findById(request.getConversationId()).ifPresent(conversation ->
                conversation.getParticipants().forEach(participantId ->
                        messagingTemplate.convertAndSend(
                                "/topic/user/" + participantId + "/inbox",
                                savedMessage
                        )
                )
        );

        log.info("Message sent by {} in conversation {}", sender.getUsername(), request.getConversationId());
    }

    // Handle typing indicators
    @MessageMapping("/chat.typing")
    public void handleTyping(@Payload Map<String, String> payload, SimpMessageHeaderAccessor headerAccessor) {

        String userId = WebSocketIdentity.userIdOf(headerAccessor.getUser());
        if (userId == null) return;

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;

        String conversationId = payload.get("conversationId");
        // Only participants may broadcast into a conversation. Without this, any
        // logged-in user could make typing indicators or read receipts appear in
        // chats they aren't part of, just by naming the conversation's id.
        if (!isParticipant(conversationId, userId)) return;

        HashMap<String, Object> typingEvent = new HashMap<>();
        typingEvent.put("userId", userId);
        typingEvent.put("username", user.getUsername());
        typingEvent.put("isTyping", Boolean.parseBoolean(payload.getOrDefault("isTyping", "true")));

        messagingTemplate.convertAndSend(
                "/topic/conversation/" + conversationId + "/typing",
                (Object) typingEvent
        );
    }

    // Handle read receipts
    @MessageMapping("/chat.read")
    public void handleRead(@Payload Map<String, String> payload, SimpMessageHeaderAccessor headerAccessor) {

        String userId = WebSocketIdentity.userIdOf(headerAccessor.getUser());
        if (userId == null) return;

        String conversationId = payload.get("conversationId");
        // Only participants may broadcast into a conversation. Without this, any
        // logged-in user could make typing indicators or read receipts appear in
        // chats they aren't part of, just by naming the conversation's id.
        if (!isParticipant(conversationId, userId)) return;

        messageService.markAsRead(conversationId, userId);

        // Notify other participants that messages were read
        HashMap<String, Object> readEvent = new HashMap<>();
        readEvent.put("userId", userId);
        readEvent.put("conversationId", conversationId);

        messagingTemplate.convertAndSend(
                "/topic/conversation/" + conversationId + "/read",
                (Object) readEvent
        );
    }

    /**
     * A connection has been accepted.
     *
     * SessionConnectedEvent, not SessionConnectEvent: this one fires only after
     * the server has accepted the CONNECT — that is, after
     * StompAuthChannelInterceptor verified the token and attached the user. So
     * event.getUser() is the server's own conclusion about who this is.
     *
     * The old handler read a "userId" header the browser chose, which let anyone
     * mark any account online and then act as it.
     */
    @EventListener
    public void handleWebSocketConnect(SessionConnectedEvent event) {
        String userId = WebSocketIdentity.userIdOf(event.getUser());
        if (userId == null) return;

        String sessionId = SimpMessageHeaderAccessor.wrap(event.getMessage()).getSessionId();
        presenceService.connected(userId, sessionId);
        log.info("User {} connected (session: {})", userId, sessionId);
    }

    @EventListener
    public void handleWebSocketDisconnect(SessionDisconnectEvent event) {
        String userId = WebSocketIdentity.userIdOf(event.getUser());
        if (userId == null) return;

        presenceService.disconnected(userId, event.getSessionId());
        log.info("User {} disconnected (session: {})", userId, event.getSessionId());
    }

    private boolean isParticipant(String conversationId, String userId) {
        if (conversationId == null) return false;
        return conversationRepository.findById(conversationId)
                .map(c -> c.getParticipants() != null && c.getParticipants().contains(userId))
                .orElse(false);
    }
}
