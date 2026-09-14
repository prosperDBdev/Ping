package com.example.pingBackend.security;

import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The security checkpoint for the live connection. Every frame a client sends
 * passes through here before any controller sees it.
 *
 * Three jobs:
 *
 *   CONNECT    — WHO ARE YOU? Check the login token. No valid token, no
 *                connection. If it's valid, attach the user to the connection;
 *                Spring then carries that identity on every later frame.
 *
 *   SUBSCRIBE  — ARE YOU ALLOWED TO LISTEN HERE? Knowing who someone is isn't
 *                enough. Messages are broadcast to named topics, and without
 *                this check a logged-in user could subscribe to someone else's
 *                inbox topic and quietly receive all of their messages.
 *
 *   SEND       — only from a connection that authenticated.
 *
 * Note this only checks at the moment of subscribing. Access that is later taken
 * away (being removed from a group) is revoked separately — see
 * SubscriptionRevoker.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    // Every topic the backend broadcasts to has one of exactly these shapes.
    //
    // The conversation pattern lists its sub-topics exactly rather than allowing
    // anything after the id. An exact list means SubscriptionRevoker knows every
    // topic a member could possibly be listening on, so revoking access can't
    // miss one.
    private static final Pattern USER_TOPIC = Pattern.compile("^/topic/user/([^/]+)(/[^/]+)*$");
    private static final Pattern CONVERSATION_TOPIC =
            Pattern.compile("^/topic/conversation/([^/]+)(/typing|/read)?$");

    private final TokenAuthenticator tokenAuthenticator;
    private final ConversationRepository conversationRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message; // heartbeats and other non-command frames
        }

        switch (accessor.getCommand()) {
            case CONNECT, STOMP -> authenticate(accessor);
            case SUBSCRIBE -> authorizeSubscription(accessor);
            case SEND -> requireUser(accessor);
            default -> {
                // UNSUBSCRIBE, DISCONNECT, ACK... carry no data and grant nothing.
            }
        }
        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String header = accessor.getFirstNativeHeader("Authorization");
        String token = header != null && header.startsWith("Bearer ") ? header.substring(7) : null;

        User user = tokenAuthenticator.authenticate(token).orElseThrow(() -> {
            log.warn("Refused WebSocket connection without a valid token (session {})", accessor.getSessionId());
            // Throwing here makes Spring answer with an ERROR frame and close the
            // connection — the client never reaches CONNECTED.
            return new MessageDeliveryException("Unauthorized");
        });

        accessor.setUser(new UserIdAuthentication(user));
    }

    private String requireUser(StompHeaderAccessor accessor) {
        String userId = WebSocketIdentity.userIdOf(accessor.getUser());
        if (userId == null) {
            throw new MessageDeliveryException("Unauthorized");
        }
        return userId;
    }

    private void authorizeSubscription(StompHeaderAccessor accessor) {
        String userId = requireUser(accessor);
        String destination = accessor.getDestination();

        if (!maySubscribe(userId, destination)) {
            log.warn("Refused subscription by user {} to {}", userId, destination);
            throw new MessageDeliveryException("Forbidden");
        }
    }

    /**
     * Allow-list, not block-list: a destination is refused unless a rule below
     * explicitly allows it. Anything new or unexpected is denied by default.
     */
    boolean maySubscribe(String userId, String destination) {
        if (destination == null) {
            return false;
        }

        // WILDCARDS. Spring's simple broker treats subscription destinations as
        // PATTERNS, so "/topic/user/*/inbox" would match every user's inbox at
        // once and "/topic/**" would match everything. A normal client never
        // subscribes with a wildcard, so any of these characters is refused
        // outright rather than relying on the rules below to catch every form.
        if (destination.contains("*") || destination.contains("?")
                || destination.contains("{") || destination.contains("..")) {
            return false;
        }

        // /topic/user/{id}/... — your own personal topics only.
        Matcher user = USER_TOPIC.matcher(destination);
        if (user.matches()) {
            return user.group(1).equals(userId);
        }

        // /topic/conversation/{id}[/typing|/read] — only conversations you're part of.
        Matcher conversation = CONVERSATION_TOPIC.matcher(destination);
        if (conversation.matches()) {
            return conversationRepository.findById(conversation.group(1))
                    .map(c -> c.getParticipants() != null && c.getParticipants().contains(userId))
                    .orElse(false);
        }

        return false;
    }

    /**
     * The identity attached to a live connection, named by the user's id.
     *
     * Spring uses the principal's NAME to track who is connected (SimpUserRegistry)
     * and to route /user/... destinations. The plain token would answer getName()
     * by calling toString() on the User object — and Lombok's @Data toString
     * includes every field, the password hash among them. That string would have
     * become this user's key inside Spring's registry. Naming the principal by id
     * keeps the hash out of it, and gives SubscriptionRevoker a key it can look
     * users up by.
     */
    static final class UserIdAuthentication extends UsernamePasswordAuthenticationToken {
        private final String userId;

        UserIdAuthentication(User user) {
            super(user, null, Collections.emptyList());
            this.userId = user.getId();
        }

        @Override
        public String getName() {
            return userId;
        }
    }
}
