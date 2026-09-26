package com.example.pingBackend.service;

import com.example.pingBackend.config.PushProperties;
import com.example.pingBackend.dto.response.MessageResponse;
import com.example.pingBackend.exception.BadRequestException;
import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.PushSubscription;
import com.example.pingBackend.repository.PushSubscriptionRepository;
import com.example.pingBackend.service.push.WebPushCrypto;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.GeneralSecurityException;
import java.security.interfaces.ECPrivateKey;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

/**
 * Web Push: notifications that reach a phone even when Ping is closed.
 *
 * Each device that allows notifications registers a subscription: a URL on its
 * browser vendor's push service plus keys to encrypt for it. When a message
 * arrives, every recipient's devices get a push through that URL, and the
 * service worker on the phone turns it into a notification.
 *
 * THE SECURITY-CRITICAL PART IS subscribe(). The endpoint URL comes from the
 * browser, which means from anyone, and this server will later send HTTP
 * requests to it. Accepting any URL would let an attacker register
 * http://mongo:27017, a cloud metadata address or anything on the internal
 * network, and have this server send requests there on their behalf:
 * server-side request forgery (SSRF). So only HTTPS addresses on the real push
 * services are accepted, and the HTTP client never follows redirects, so an
 * allowed address can't bounce a request somewhere else.
 */
@Service
@Slf4j
public class PushService {

    /** Exact push-service hosts. */
    private static final Set<String> PUSH_HOSTS = Set.of(
            "fcm.googleapis.com",                // Chrome, Edge, Android
            "android.googleapis.com",            // older Chrome subscriptions
            "updates.push.services.mozilla.com"  // Firefox
    );

    /** Push services that use per-region subdomains. The leading dot matters. */
    private static final List<String> PUSH_HOST_SUFFIXES = List.of(
            ".push.apple.com",       // Safari and iPhone (web.push.apple.com)
            ".notify.windows.com",   // Windows push (WNS)
            ".push.services.mozilla.com"
    );

    /** Enough for a phone, a laptop and a few browsers; stops unbounded growth. */
    private static final int MAX_DEVICES_PER_USER = 10;

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final PushSubscriptionRepository repository;
    private final MongoTemplate mongoTemplate;
    private final PushProperties properties;
    private final ECPrivateKey vapidKey;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            // SSRF defence, part two: never follow a redirect. The allow-list
            // checks the address we were given; a redirect could lead anywhere.
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    // Same pattern as EmailService: a private pool, so sending pushes never
    // slows down sending the message itself, and a flood can't queue unbounded
    // work in memory.
    private final ThreadPoolExecutor sender = new ThreadPoolExecutor(
            2, 2, 0L, TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(500),
            runnable -> {
                Thread thread = new Thread(runnable, "ping-push");
                thread.setDaemon(true);
                return thread;
            },
            (runnable, executor) -> log.warn("Push queue full — a notification was dropped"));

    public PushService(PushSubscriptionRepository repository, MongoTemplate mongoTemplate, PushProperties properties) {
        this.repository = repository;
        this.mongoTemplate = mongoTemplate;
        this.properties = properties;

        ECPrivateKey key = null;
        if (properties.enabled()) {
            try {
                key = WebPushCrypto.privateKey(Base64.getUrlDecoder().decode(properties.vapidPrivateKey()));
            } catch (IllegalArgumentException | GeneralSecurityException e) {
                log.error("VAPID_PRIVATE_KEY is not a valid key. Push notifications are OFF until it is fixed.");
            }
        } else {
            log.info("Push notifications are off: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set.");
        }
        this.vapidKey = key;
    }

    public boolean enabled() {
        return vapidKey != null;
    }

    /** The public half, which browsers need to subscribe. Null when push is off. */
    public String publicKey() {
        return enabled() ? properties.vapidPublicKey() : null;
    }

    /**
     * Register (or re-register) this device for the signed-in user.
     *
     * Upserts on the endpoint in one atomic step. If the device was previously
     * registered to someone else (a shared computer, a different account), it
     * now belongs to whoever is signed in: notifications follow the person
     * using the device, not whoever used it first.
     */
    public void subscribe(String userId, String endpoint, String p256dh, String auth) {
        if (!isAllowedEndpoint(endpoint)) {
            throw new BadRequestException("That isn't a push service address");
        }
        requireKey(p256dh, 65);
        requireKey(auth, 16);

        LocalDateTime now = LocalDateTime.now();
        mongoTemplate.upsert(
                query(where("endpoint").is(endpoint)),
                new Update()
                        .set("userId", userId)
                        .set("p256dh", p256dh)
                        .set("auth", auth)
                        .set("updatedAt", now)
                        .setOnInsert("createdAt", now),
                PushSubscription.class);

        List<PushSubscription> devices = repository.findByUserIdOrderByUpdatedAtDesc(userId);
        if (devices.size() > MAX_DEVICES_PER_USER) {
            repository.deleteAll(devices.subList(MAX_DEVICES_PER_USER, devices.size()));
        }
    }

    /** Stop pushing to this device. Only removes it if it's the caller's own. */
    public void unsubscribe(String userId, String endpoint) {
        mongoTemplate.remove(query(where("endpoint").is(endpoint).and("userId").is(userId)), PushSubscription.class);
    }

    /**
     * Queue a push for every recipient of a new message. Returns immediately.
     *
     * Only new messages: edits and reactions don't come through here, just as
     * they don't raise pop-ups or unread counts.
     */
    public void notifyNewMessage(Conversation conversation, MessageResponse message) {
        if (!enabled() || message.getSenderId() == null) return;

        String title = "GROUP".equals(conversation.getType()) && conversation.getName() != null
                ? message.getSenderUsername() + " · " + conversation.getName()
                : message.getSenderUsername();

        byte[] payload;
        try {
            payload = JSON.writeValueAsBytes(Map.of(
                    "title", title == null ? "Ping" : title,
                    "body", preview(message),
                    "conversationId", conversation.getId(),
                    // Lets the phone recognise a message it has already shown
                    // (the open tab may have announced it first) and not buzz twice.
                    "messageId", message.getId() == null ? "" : message.getId()));
        } catch (RuntimeException e) {
            log.warn("Couldn't build a push payload: {}", e.getMessage());
            return;
        }

        List<String> recipients = conversation.getParticipants().stream()
                .filter(id -> !id.equals(message.getSenderId()))
                .toList();

        sender.execute(() -> recipients.forEach(userId ->
                repository.findByUserId(userId).forEach(device -> deliver(device, payload))));
    }

    /**
     * Queue a push to specific people: task added, task reminders. Returns
     * immediately. `tag` groups notifications on the phone (one per task),
     * separately from the chat's message notifications.
     */
    public void notifyUsers(List<String> userIds, String title, String body, String conversationId, String tag) {
        if (!enabled() || userIds.isEmpty()) return;
        byte[] payload;
        try {
            payload = JSON.writeValueAsBytes(Map.of(
                    "title", title,
                    "body", body,
                    "conversationId", conversationId,
                    "tag", tag,
                    "messageId", tag));
        } catch (RuntimeException e) {
            log.warn("Couldn't build a push payload: {}", e.getMessage());
            return;
        }
        sender.execute(() -> userIds.forEach(userId ->
                repository.findByUserId(userId).forEach(device -> deliver(device, payload))));
    }

    /**
     * Encrypt and send one push to one device.
     *
     * 404 or 410 from the push service means the subscription is gone (the
     * user cleared site data, uninstalled, or revoked permission), so the
     * record is deleted rather than retried forever. Package-private for the
     * test. Endpoints are never logged: each one is a key to a device.
     */
    void deliver(PushSubscription device, byte[] payload) {
        try {
            byte[] body = WebPushCrypto.encrypt(payload,
                    Base64.getUrlDecoder().decode(device.getP256dh()),
                    Base64.getUrlDecoder().decode(device.getAuth()));
            URI endpoint = URI.create(device.getEndpoint());
            String audience = endpoint.getScheme() + "://" + endpoint.getRawAuthority();
            String token = WebPushCrypto.vapidToken(vapidKey, audience, properties.vapidSubject(),
                    Instant.now().plus(Duration.ofHours(12)));

            HttpRequest request = HttpRequest.newBuilder(endpoint)
                    .timeout(Duration.ofSeconds(15))
                    .header("TTL", "86400")
                    .header("Urgency", "high")
                    .header("Content-Encoding", "aes128gcm")
                    .header("Content-Type", "application/octet-stream")
                    .header("Authorization", "vapid t=" + token + ", k=" + properties.vapidPublicKey())
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();

            int status = http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (status == 404 || status == 410) {
                repository.deleteByEndpoint(device.getEndpoint());
                log.info("Removed a push subscription the push service no longer recognises");
            } else if (status >= 400) {
                log.warn("Push service refused a notification: HTTP {}", status);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("Push delivery failed: {}", e.getClass().getSimpleName());
        }
    }

    /**
     * The SSRF allow-list: HTTPS, the default port, no embedded credentials,
     * and a host that is one of the real push services.
     *
     * The userinfo check matters: in https://fcm.googleapis.com@evil.example/
     * the real host is evil.example, and a naive "starts with" or "contains"
     * check would wave it through.
     */
    static boolean isAllowedEndpoint(String endpoint) {
        if (endpoint == null || endpoint.length() > 1000) return false;
        URI uri;
        try {
            uri = new URI(endpoint);
        } catch (URISyntaxException e) {
            return false;
        }
        if (!"https".equals(uri.getScheme()) || uri.getRawUserInfo() != null || uri.getHost() == null) {
            return false;
        }
        if (uri.getPort() != -1 && uri.getPort() != 443) return false;

        String host = uri.getHost().toLowerCase(Locale.ROOT);
        return PUSH_HOSTS.contains(host) || PUSH_HOST_SUFFIXES.stream().anyMatch(host::endsWith);
    }

    /** One line of preview, like a lock screen. Replies show the reply, not the quote. */
    static String preview(MessageResponse message) {
        String mime = message.getAttachment() == null || message.getAttachment().getMimeType() == null
                ? "" : message.getAttachment().getMimeType();
        if (mime.startsWith("image/")) return "📷 Photo";
        if (mime.startsWith("audio/") || mime.equals("application/x-matroska") || mime.equals("video/webm")) {
            return "🎤 Voice message";
        }

        String text = message.getContent() == null ? "" : message.getContent();
        int newline = text.indexOf('\n');
        if (text.startsWith("{\"__replyTo\"") && newline >= 0) {
            text = text.substring(newline + 1);
        }
        text = text.strip();
        if (text.isEmpty()) return "New message";
        return text.length() > 120 ? text.substring(0, 117) + "…" : text;
    }

    private static void requireKey(String value, int expectedLength) {
        byte[] decoded;
        try {
            decoded = Base64.getUrlDecoder().decode(value == null ? "" : value);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid push keys");
        }
        if (decoded.length != expectedLength) {
            throw new BadRequestException("Invalid push keys");
        }
        if (expectedLength == 65) {
            try {
                WebPushCrypto.publicKey(decoded);
            } catch (GeneralSecurityException e) {
                throw new BadRequestException("Invalid push keys");
            }
        }
    }

    @PreDestroy
    void shutdown() {
        sender.shutdown();
    }
}
