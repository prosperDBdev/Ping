package com.example.pingBackend.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.broker.SimpleBrokerMessageHandler;
import org.springframework.messaging.simp.broker.SubscriptionRegistry;
import org.springframework.messaging.simp.user.SimpSession;
import org.springframework.messaging.simp.user.SimpSubscription;
import org.springframework.messaging.simp.user.SimpUser;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Cancels live subscriptions when someone loses access.
 *
 * THE PROBLEM. Permission to listen to a conversation is checked when a client
 * SUBSCRIBES (StompAuthChannelInterceptor). But a subscription, once granted,
 * stays open. So a member removed from a group kept receiving every new message
 * in real time until they happened to reconnect — the check had passed once, and
 * nothing ever asked again.
 *
 * THE GENERAL LESSON. Granting access and checking access are not the same
 * moment. Anything that grants long-lived access — an open subscription, a
 * session, a cached permission — has to be REVOKED when the permission changes,
 * or the old decision outlives the reason for it.
 *
 * THE FIX. When a member is removed, look up every open connection that user has
 * and cancel each of their subscriptions to that conversation's topics, directly
 * in the broker's subscription registry. From that moment the broker simply has
 * nothing to deliver to them.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SubscriptionRevoker {

    // Looked up lazily rather than injected. The broker handler is created as part
    // of Spring's WebSocket infrastructure, and its declared bean type isn't
    // reliably SimpleBrokerMessageHandler at the moment other beans are being
    // wired. By the time anyone is removed from a group the app is fully started
    // and the lookup is safe.
    private final ApplicationContext applicationContext;

    // Spring's own record of who is connected. Keyed by the principal's name, which
    // StompAuthChannelInterceptor makes the user id.
    private final SimpUserRegistry userRegistry;

    /**
     * Stop one user receiving live updates for one conversation.
     *
     * @return how many subscriptions were cancelled (0 if they weren't connected)
     */
    public int revokeConversation(String userId, String conversationId) {
        SimpUser user = userRegistry.getUser(userId);
        if (user == null) {
            return 0; // not connected — nothing open to cancel
        }

        String base = "/topic/conversation/" + conversationId;
        SubscriptionRegistry registry =
                applicationContext.getBean("simpleBrokerMessageHandler", SimpleBrokerMessageHandler.class)
                        .getSubscriptionRegistry();

        // Collect first, then cancel — the session's subscription set may change
        // underneath a loop that modifies it while iterating.
        record Open(String sessionId, String subscriptionId) {
        }
        List<Open> toCancel = new ArrayList<>();
        for (SimpSession session : user.getSessions()) {
            for (SimpSubscription subscription : session.getSubscriptions()) {
                String destination = subscription.getDestination();
                // The conversation topic itself, and its /typing and /read sub-topics.
                if (destination.equals(base) || destination.startsWith(base + "/")) {
                    toCancel.add(new Open(session.getId(), subscription.getId()));
                }
            }
        }

        for (Open open : toCancel) {
            registry.unregisterSubscription(unsubscribeMessage(open.sessionId(), open.subscriptionId()));
        }

        if (!toCancel.isEmpty()) {
            log.info("Revoked {} live subscription(s) for user {} to conversation {}",
                    toCancel.size(), userId, conversationId);
        }
        return toCancel.size();
    }

    /** The registry cancels subscriptions from an UNSUBSCRIBE message, the same shape a client would send. */
    private static Message<byte[]> unsubscribeMessage(String sessionId, String subscriptionId) {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create(SimpMessageType.UNSUBSCRIBE);
        accessor.setSessionId(sessionId);
        accessor.setSubscriptionId(subscriptionId);
        accessor.setLeaveMutable(false);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
