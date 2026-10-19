package com.example.pingBackend.service;

import com.example.pingBackend.exception.GoneException;
import com.example.pingBackend.model.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Signing in on a computer by scanning a QR code with your phone (Stage 14).
 *
 * THE FLOW
 *   1. The computer opens a WebSocket to /ws-pair. The server makes a random
 *      code, remembers which socket asked for it, and sends it down. The
 *      computer shows it as a QR code.
 *   2. Your phone, already signed in, scans it and asks "which device is
 *      this?" (the computer's browser and system), then you tap Approve.
 *   3. The server pushes a one-time REDEEM code down that computer's socket.
 *   4. The computer POSTs the redeem code to /api/pairing/redeem (public;
 *      rate-limited per IP). THAT response — normal HTTP, to the computer's
 *      own browser — issues the session and sends the login cookie with it,
 *      so the token never travels in a WebSocket body and never passes
 *      through JavaScript on its way to the cookie jar.
 *
 * WHY A SOCKET. The computer has no account yet, so it can't be sent anything
 * the normal way, and polling "approved yet?" every second would be slow and
 * wasteful. An open socket lets the server answer the moment you tap Approve.
 *
 * THE CODE IS THE ONLY LINK between the phone and the computer, so it's
 * treated like a password: 256 random bits (unguessable), valid for 2
 * minutes, single use (removed from the map by the approval itself, so two
 * approvals can't both succeed), and never logged. The redeem code holds the
 * same status: unguessable, two minutes, burned on first use.
 *
 * THE RISK THIS FLOW HAS, called "QRLjacking": an attacker opens this page on
 * THEIR computer and tricks you into scanning their code ("scan to join the
 * giveaway!"). Approving would sign the attacker in as you. The defence is the
 * approval screen: it names the device asking and tells you to approve only a
 * computer in front of you that you're setting up yourself.
 *
 * In memory, like the rate limits: a restart drops pending codes (the
 * computer just shows a fresh one), and it assumes one server instance.
 */
@Service
@Slf4j
public class PairingService {

    static final Duration CODE_LIFETIME = Duration.ofMinutes(2);

    /** How long an approved (but not yet redeemed) sign-in may wait. */
    static final Duration REDEEM_LIFETIME = Duration.ofMinutes(2);

    /** A cap on waiting codes, so opening sockets in bulk can't exhaust memory. */
    static final int MAX_PENDING = 1000;

    private static final JsonMapper JSON = JsonMapper.builder().build();

    /**
     * A waiting computer, and — once you've approved — WHO it was approved
     * for. approvedBy null means "still showing its QR"; non-null means
     * "approved, now waiting up to REDEEM_LIFETIME for the computer to call
     * redeem()". The socket no longer matters once approved (it was closed
     * right after the redeem code went down it).
     */
    private record Pending(WebSocketSession socket, String deviceName, Instant expiresAt, User approvedBy) {
    }

    private final Map<String, Pending> pending = new ConcurrentHashMap<>();
    private final SessionService sessionService;

    public PairingService(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    /** Step 1: a new code for a computer's socket. Empty if the server is at its cap. */
    public Optional<String> open(WebSocketSession socket, String deviceName) {
        if (pending.size() >= MAX_PENDING) {
            return Optional.empty();
        }
        String code = PasswordResetService.newToken();
        pending.put(code, new Pending(socket, deviceName, Instant.now().plus(CODE_LIFETIME), null));
        send(socket, Map.of("type", "code", "code", code, "expiresInSeconds", CODE_LIFETIME.toSeconds()));
        return Optional.of(code);
    }

    /** Step 2: what the phone shows before you approve. */
    public String deviceFor(String code) {
        Pending p = code == null ? null : pending.get(code);
        if (p == null || p.approvedBy() != null || !isFresh(p)) {
            throw expired();
        }
        return p.deviceName();
    }

    /** Step 3: you approved. Hand the computer a redeem code, NOT a token. */
    public void approve(String code, User approver) {
        // remove() is the single-use guarantee: only one caller gets the entry.
        Pending p = code == null ? null : pending.remove(code);
        if (p == null || p.approvedBy() != null || !isFresh(p)) {
            throw expired();
        }

        // A fresh map key: nobody who only knew the QR code can now redeem,
        // and the redeem code is the only thing pushed down the socket.
        String redeemCode = PasswordResetService.newToken();
        Pending approved = new Pending(p.socket(), p.deviceName(),
                Instant.now().plus(REDEEM_LIFETIME), approver);
        pending.put(redeemCode, approved);

        boolean delivered = send(p.socket(), Map.of(
                "type", "approved",
                "redeemCode", redeemCode,
                "id", approver.getId(),
                "username", approver.getUsername(),
                "email", approver.getEmail()));
        close(p.socket(), CloseStatus.NORMAL);

        if (!delivered) {
            // The computer vanished at the last moment. There is no session
            // behind an unredeemed code, so dropping the entry is all it takes.
            pending.remove(redeemCode);
        }
    }

    /** Step 4: the computer swapped its redeem code for the real session. */
    public record Redeemed(User user, String token) {
    }

    public Redeemed redeem(String redeemCode) {
        // remove() again: one redeem per approval, second attempt finds nothing.
        Pending p = redeemCode == null ? null : pending.remove(redeemCode);
        if (p == null || p.approvedBy() == null || !isFresh(p)) {
            throw expired();
        }
        SessionService.IssuedSession issued = sessionService.issueSession(p.approvedBy(), p.deviceName(), "QR");
        return new Redeemed(p.approvedBy(), issued.token());
    }

    /** You tapped "Not me". The computer is told, and its code is gone. */
    public void deny(String code) {
        Pending p = code == null ? null : pending.remove(code);
        if (p != null && p.approvedBy() == null) {
            send(p.socket(), Map.of("type", "denied"));
            close(p.socket(), CloseStatus.NORMAL);
        }
    }

    /** The computer closed its socket (left the page): its code dies with it. */
    public void forget(WebSocketSession socket) {
        pending.entrySet().removeIf(e -> e.getValue().socket().getId().equals(socket.getId()));
    }

    /**
     * Expired codes are removed and their computers told, so the page can
     * offer a fresh code instead of showing one that no longer works.
     */
    @Scheduled(fixedRate = 15_000)
    public void sweepExpired() {
        Instant now = Instant.now();
        pending.entrySet().removeIf(e -> {
            Pending p = e.getValue();
            boolean fresh = now.isBefore(p.expiresAt());
            // Approved entries live on with a closed socket — the computer is
            // off the socket but still inside its redeem window.
            if (p.approvedBy() == null && p.socket().isOpen() && fresh) {
                return false;
            }
            if (p.approvedBy() == null && fresh) {
                send(p.socket(), Map.of("type", "expired"));
                close(p.socket(), CloseStatus.NORMAL);
            }
            return true;
        });
    }

    int pendingCount() {
        return pending.size();
    }

    private static boolean isFresh(Pending p) {
        return Instant.now().isBefore(p.expiresAt());
    }

    private static GoneException expired() {
        return new GoneException("This QR code has expired. Show a new one on the other device and scan again.");
    }

    private static boolean send(WebSocketSession socket, Map<String, ?> message) {
        if (!socket.isOpen()) {
            return false;
        }
        try {
            socket.sendMessage(new TextMessage(JSON.writeValueAsString(message)));
            return true;
        } catch (IOException | RuntimeException e) {
            log.debug("Couldn't reach a pairing socket: {}", e.getMessage());
            return false;
        }
    }

    private static void close(WebSocketSession socket, CloseStatus status) {
        try {
            socket.close(status);
        } catch (IOException e) {
            log.debug("Pairing socket was already closing: {}", e.getMessage());
        }
    }
}
