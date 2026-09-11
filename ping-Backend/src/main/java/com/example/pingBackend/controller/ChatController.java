package com.example.pingBackend.controller;

import com.example.pingBackend.dto.request.SendMessageRequest;
import com.example.pingBackend.dto.response.MessageResponse;
import com.example.pingBackend.model.Message;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.UserRepository;
import com.example.pingBackend.security.WebSocketSessionRegistry;
import com.example.pingBackend.service.MessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionConnectEvent;
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
    private final WebSocketSessionRegistry sessionRegistry;

    // Handle incoming chat messages
    @MessageMapping("/chat.send")
    public void sendMessage(@Payload SendMessageRequest request, SimpMessageHeaderAccessor headerAccessor) {

        String sessionId = headerAccessor.getSessionId();
        String userId = sessionRegistry.getUserId(sessionId);

        if (userId == null) {
            log.warn("Message from unknown session: {}", sessionId);
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

        String sessionId = headerAccessor.getSessionId();
        String userId = sessionRegistry.getUserId(sessionId);

        if (userId == null) return;

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;

        String conversationId = payload.get("conversationId");

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

        String sessionId = headerAccessor.getSessionId();
        String userId = sessionRegistry.getUserId(sessionId);

        if (userId == null) return;

        String conversationId = payload.get("conversationId");

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

    // WebSocket connect event
    @EventListener
    public void handleWebSocketConnect(SessionConnectEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String sessionId = headers.getSessionId();

        // Get userId from native headers (sent by client on connect)
        Map<String, Object> nativeHeaders = headers.getMessageHeaders();
        @SuppressWarnings("unchecked")
        Map<String, List<String>> nativeHeaderMap =
                (Map<String, List<String>>) nativeHeaders.get("nativeHeaders");

        if (nativeHeaderMap != null && nativeHeaderMap.containsKey("userId")) {
            String userId = nativeHeaderMap.get("userId").get(0);
            sessionRegistry.register(sessionId, userId);

            // Set user status to ONLINE
            userRepository.findById(userId).ifPresent(user -> {
                user.setStatus("ONLINE");
                userRepository.save(user);

                // Broadcast online status
                HashMap<String, Object> statusEvent = new HashMap<>();
                statusEvent.put("userId", userId);
                statusEvent.put("status", "ONLINE");

                messagingTemplate.convertAndSend(
                        "/topic/user/" + userId + "/status",
                        (Object) statusEvent
                );
            });

            log.info("User {} connected (session: {})", userId, sessionId);
        }
    }

    // WebSocket disconnect event
    @EventListener
    public void handleWebSocketDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        String userId = sessionRegistry.unregister(sessionId);

        if (userId != null) {
            // Set user status to OFFLINE
            userRepository.findById(userId).ifPresent(user -> {
                user.setStatus("OFFLINE");
                user.setLastSeen(LocalDateTime.now());
                userRepository.save(user);

                // Broadcast offline status
                HashMap<String, Object> statusEvent = new HashMap<>();
                statusEvent.put("userId", userId);
                statusEvent.put("status", "OFFLINE");
                statusEvent.put("lastSeen", LocalDateTime.now().toString());

                messagingTemplate.convertAndSend(
                        "/topic/user/" + userId + "/status",
                        (Object) statusEvent
                );
            });

            log.info("User {} disconnected", userId);
        }
    }
}