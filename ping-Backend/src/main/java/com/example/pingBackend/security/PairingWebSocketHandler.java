package com.example.pingBackend.security;

import com.example.pingBackend.service.PairingService;
import com.example.pingBackend.service.RateLimiter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.time.Duration;

/**
 * The /ws-pair socket: a computer waiting to be signed in by QR code.
 *
 * A plain WebSocket, not STOMP. It carries a handful of small messages one
 * way (code, then approved / denied / expired) to a browser that has no
 * account yet, so topics, subscriptions and the STOMP security checks would
 * all be machinery with nothing to do. One socket is one code: when it
 * expires the socket closes, and the page opens a new one for a fresh code.
 *
 * It accepts connections without a login token, which is the whole point, so
 * it's rate limited per IP and never trusts anything the browser sends. In
 * fact it ignores incoming messages entirely.
 */
@Component
@RequiredArgsConstructor
public class PairingWebSocketHandler extends TextWebSocketHandler {

    /** Filled in during the handshake (PairingSocketConfig). */
    public static final String IP_ATTRIBUTE = "ping.pairing.ip";
    public static final String USER_AGENT_ATTRIBUTE = "ping.pairing.userAgent";

    private final PairingService pairingService;
    private final RateLimiter rateLimiter;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Object ip = session.getAttributes().get(IP_ATTRIBUTE);
        if (!rateLimiter.tryAcquire("pairing:ip:" + ip, 30, Duration.ofMinutes(10))) {
            session.close(new CloseStatus(4429, "Too many QR codes. Please wait a few minutes."));
            return;
        }

        // Messages reach this socket from other threads (the phone's approval
        // request, the expiry sweep). A raw WebSocket session must not be
        // written by two threads at once; this wrapper queues the writes.
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session, 5_000, 16 * 1024);
        String device = DeviceNames.describe((String) session.getAttributes().get(USER_AGENT_ATTRIBUTE));
        if (pairingService.open(safe, device).isEmpty()) {
            session.close(CloseStatus.SERVICE_OVERLOAD);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        pairingService.forget(session);
    }
}
