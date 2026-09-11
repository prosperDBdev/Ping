package com.example.pingBackend.service;

import com.example.pingBackend.dto.response.TemporaryChatInviteResponse;
import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.TemporaryConversationInvite;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.TemporaryConversationInviteRepository;
import com.example.pingBackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TemporaryConversationService {

    private final TemporaryConversationInviteRepository inviteRepository;
    private final ConversationService conversationService;
    private final UserRepository userRepository;

    /**
     * How long a PENDING invite stays actionable. Applied in BOTH the listing
     * and the accept path on purpose — filtering stale invites out of the list
     * only hides them from the UI, it doesn't stop someone from accepting one
     * by its ID directly. Same principle as expired conversations: the server
     * enforces it, the UI merely reflects it.
     */
    private static final long INVITE_VALIDITY_HOURS = 24;

    public TemporaryChatInviteResponse createInvite(String fromUserId, String toUserId, long durationMs, String durationLabel) {
        if (fromUserId.equals(toUserId)) {
            throw new RuntimeException("You can't start a temporary conversation with yourself");
        }

        User fromUser = userRepository.findById(fromUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        userRepository.findById(toUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        TemporaryConversationInvite invite = TemporaryConversationInvite.builder()
                .fromUserId(fromUserId)
                .toUserId(toUserId)
                .durationMs(durationMs)
                .durationLabel(durationLabel)
                .build();

        return mapInvite(inviteRepository.save(invite), fromUser.getUsername());
    }

    /**
     * Invites addressed to this user that are still waiting on a response.
     * Fetched on load so an invite that arrived while they were offline isn't
     * lost — the WebSocket push only reaches someone with the app already open.
     */
    public List<TemporaryChatInviteResponse> getPendingInvites(String userId) {
        LocalDateTime staleCutoff = LocalDateTime.now().minusHours(INVITE_VALIDITY_HOURS);

        return inviteRepository
                .findByToUserIdAndStatusAndCreatedAtAfterOrderByCreatedAtDesc(userId, "PENDING", staleCutoff)
                .stream()
                .map(invite -> {
                    String fromUsername = userRepository.findById(invite.getFromUserId())
                            .map(User::getUsername)
                            .orElse("Unknown");
                    return mapInvite(invite, fromUsername);
                })
                .collect(Collectors.toList());
    }

    /**
     * The outcome of a response, carrying everything the controller needs to
     * build both the notification back to the outcome's own caller and the
     * one pushed to the original inviter — {@code conversation} is null on
     * decline.
     */
    public record InviteOutcome(
            TemporaryConversationInvite invite,
            String responderUsername,
            Conversation conversation
    ) {}

    public InviteOutcome respondToInvite(String inviteId, String respondingUserId, boolean accept) {
        TemporaryConversationInvite invite = inviteRepository.findById(inviteId)
                .orElseThrow(() -> new RuntimeException("Invite not found"));

        if (!invite.getToUserId().equals(respondingUserId)) {
            throw new RuntimeException("This invite isn't addressed to you");
        }
        if (!"PENDING".equals(invite.getStatus())) {
            throw new RuntimeException("This invite has already been responded to");
        }
        // Enforced here too, not just in the listing query — otherwise a stale
        // invite is merely hidden from the UI while still being acceptable by
        // ID over the WebSocket.
        if (invite.getCreatedAt().isBefore(LocalDateTime.now().minusHours(INVITE_VALIDITY_HOURS))) {
            throw new RuntimeException("This invite has expired");
        }

        User responder = userRepository.findById(respondingUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!accept) {
            invite.setStatus("DECLINED");
            inviteRepository.save(invite);
            return new InviteOutcome(invite, responder.getUsername(), null);
        }

        LocalDateTime expiresAt = LocalDateTime.now().plus(Duration.ofMillis(invite.getDurationMs()));
        Conversation conversation = conversationService.createTemporaryConversationEntity(
                invite.getFromUserId(), invite.getToUserId(), expiresAt);

        invite.setStatus("ACCEPTED");
        invite.setResultingConversationId(conversation.getId());
        inviteRepository.save(invite);

        return new InviteOutcome(invite, responder.getUsername(), conversation);
    }

    private TemporaryChatInviteResponse mapInvite(TemporaryConversationInvite invite, String fromUsername) {
        return TemporaryChatInviteResponse.builder()
                .id(invite.getId())
                .fromUserId(invite.getFromUserId())
                .fromUsername(fromUsername)
                .toUserId(invite.getToUserId())
                .durationMs(invite.getDurationMs())
                .durationLabel(invite.getDurationLabel())
                .status(invite.getStatus())
                .createdAt(invite.getCreatedAt())
                .build();
    }
}
