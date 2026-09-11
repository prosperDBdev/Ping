package com.example.pingBackend.controller;

import com.example.pingBackend.dto.request.TemporaryChatInviteRequest;
import com.example.pingBackend.dto.request.TemporaryChatRespondRequest;
import com.example.pingBackend.dto.response.ConversationResponse;
import com.example.pingBackend.dto.response.TemporaryChatInviteResponse;
import com.example.pingBackend.dto.response.TemporaryChatResponseNotification;
import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.security.WebSocketSessionRegistry;
import com.example.pingBackend.service.ConversationService;
import com.example.pingBackend.service.TemporaryConversationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
@Slf4j
public class TemporaryChatController {

    private final SimpMessagingTemplate messagingTemplate;
    private final TemporaryConversationService temporaryConversationService;
    private final ConversationService conversationService;
    private final WebSocketSessionRegistry sessionRegistry;

    // The proposer sends this; nothing is created yet — just a pending
    // invite the recipient has to see and act on.
    @MessageMapping("/temp-chat.invite")
    public void invite(@Payload TemporaryChatInviteRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String fromUserId = sessionRegistry.getUserId(headerAccessor.getSessionId());
        if (fromUserId == null) return;

        TemporaryChatInviteResponse invite;
        try {
            invite = temporaryConversationService.createInvite(
                    fromUserId, request.getToUserId(), request.getDurationMs(), request.getDurationLabel());
        } catch (RuntimeException e) {
            log.warn("Temp chat invite failed: {}", e.getMessage());
            return;
        }

        messagingTemplate.convertAndSend(
                "/topic/user/" + request.getToUserId() + "/temp-chat-invite",
                invite
        );

        log.info("Temporary chat invite sent {} -> {}", fromUserId, request.getToUserId());
    }

    // The recipient accepts or declines. Only on accept does a real
    // Conversation get created — pushed to both parties directly, so neither
    // client needs to refetch their conversation list to see it appear.
    @MessageMapping("/temp-chat.respond")
    public void respond(@Payload TemporaryChatRespondRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String respondingUserId = sessionRegistry.getUserId(headerAccessor.getSessionId());
        if (respondingUserId == null) return;

        TemporaryConversationService.InviteOutcome outcome;
        try {
            outcome = temporaryConversationService.respondToInvite(
                    request.getInviteId(), respondingUserId, request.isAccept());
        } catch (RuntimeException e) {
            log.warn("Temp chat response failed: {}", e.getMessage());
            return;
        }

        String fromUserId = outcome.invite().getFromUserId();
        String toUserId = outcome.invite().getToUserId();
        Conversation conversation = outcome.conversation();

        if (conversation != null) {
            // Each side gets the conversation mapped from their own point of
            // view (unread counts, etc. are per-user).
            ConversationResponse forInviter = conversationService.mapToResponse(conversation, fromUserId);
            ConversationResponse forResponder = conversationService.mapToResponse(conversation, toUserId);

            messagingTemplate.convertAndSend("/topic/user/" + fromUserId + "/conversation-created", forInviter);
            messagingTemplate.convertAndSend("/topic/user/" + toUserId + "/conversation-created", forResponder);
        }

        messagingTemplate.convertAndSend(
                "/topic/user/" + fromUserId + "/temp-chat-response",
                TemporaryChatResponseNotification.builder()
                        .inviteId(outcome.invite().getId())
                        .accepted(request.isAccept())
                        .byUsername(outcome.responderUsername())
                        .conversation(conversation != null
                                ? conversationService.mapToResponse(conversation, fromUserId)
                                : null)
                        .build()
        );

        log.info("Temporary chat invite {} {} by {}",
                outcome.invite().getId(), request.isAccept() ? "accepted" : "declined", respondingUserId);
    }
}
