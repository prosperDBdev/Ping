package com.example.pingBackend.service;

import com.example.pingBackend.config.PushProperties;
import com.example.pingBackend.dto.response.MessageResponse;
import com.example.pingBackend.exception.BadRequestException;
import com.example.pingBackend.model.Message;
import com.example.pingBackend.model.PushSubscription;
import com.example.pingBackend.repository.PushSubscriptionRepository;
import com.example.pingBackend.service.push.WebPushCrypto;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Web Push: the SSRF allow-list, key checks, previews and delivery.
 *
 * Delivery is tested against a small HTTP server on this machine standing in
 * for a push service. That only works because the allow-list is enforced when
 * a device REGISTERS, and deliver() is called directly here. The encryption
 * itself is pinned to the RFC in WebPushCryptoTest.
 */
class PushServiceTest {

    // RFC 8291's example key pair, reused as this test server's VAPID keys.
    private static final PushProperties KEYS = new PushProperties(
            "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
            "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
            "mailto:security@ebitimi.dev");

    @Test
    @DisplayName("real push services are accepted")
    void realServicesAllowed() {
        for (String ok : List.of(
                "https://fcm.googleapis.com/fcm/send/abc123",
                "https://updates.push.services.mozilla.com/wpush/v2/abc",
                "https://web.push.apple.com/QGuQyavXutnMH8",
                "https://db5p.notify.windows.com/w/?token=abc")) {
            assertTrue(PushService.isAllowedEndpoint(ok), ok);
        }
    }

    @Test
    @DisplayName("anything else is refused: this is the SSRF defence")
    void everythingElseRefused() {
        for (String bad : List.of(
                "http://fcm.googleapis.com/fcm/send/abc",           // not HTTPS
                "https://localhost/push",                           // this machine
                "https://127.0.0.1/push",
                "https://169.254.169.254/latest/meta-data/",        // cloud metadata
                "https://mongo:27017/",                             // a container on the private network
                "https://fcm.googleapis.com:8443/fcm/send/abc",     // right host, odd port
                "https://fcm.googleapis.com@evil.example/push",     // userinfo trick: real host is evil.example
                "https://fcm.googleapis.com.evil.example/push",     // lookalike suffix
                "https://evilpush.apple.com.example.org/",
                "https://notpush.apple.com/",                       // no leading dot: not a subdomain
                "ftp://fcm.googleapis.com/",
                "not a url",
                "https://fcm.googleapis.com/" + "a".repeat(1000))) {
            assertFalse(PushService.isAllowedEndpoint(bad), bad);
        }
    }

    @Test
    @DisplayName("malformed device keys are rejected before anything is stored")
    void badKeysRejected() {
        PushService service = new PushService(null, null, KEYS);
        String endpoint = "https://fcm.googleapis.com/fcm/send/abc";
        String goodAuth = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]);

        assertThrows(BadRequestException.class, () -> service.subscribe("u", endpoint, "not-a-key", goodAuth));
        assertThrows(BadRequestException.class, () -> service.subscribe("u", endpoint, KEYS.vapidPublicKey(), "short"));
        assertThrows(BadRequestException.class, () -> service.subscribe("u", "https://evil.example/", KEYS.vapidPublicKey(), goodAuth));
    }

    @Test
    @DisplayName("the lock-screen preview shows the reply text, labels media, and is kept short")
    void previews() {
        assertEquals("sounds good", PushService.preview(text("{\"__replyTo\":{\"sender\":\"amy\",\"snippet\":\"hi\"}}\nsounds good")));
        assertEquals("📷 Photo", PushService.preview(media("image/jpeg")));
        assertEquals("🎤 Voice message", PushService.preview(media("audio/webm")));
        assertEquals(118, PushService.preview(text("x".repeat(500))).length());
    }

    @Test
    @DisplayName("a push is sent encrypted with a VAPID signature, and a gone device is forgotten")
    void deliversAndForgetsGoneDevices() throws Exception {
        AtomicReference<String> authorization = new AtomicReference<>();
        AtomicReference<String> encoding = new AtomicReference<>();
        AtomicReference<Integer> bodyLength = new AtomicReference<>();
        AtomicReference<Integer> reply = new AtomicReference<>(201);

        HttpServer fakePushService = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        fakePushService.createContext("/", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            encoding.set(exchange.getRequestHeaders().getFirst("Content-Encoding"));
            bodyLength.set(exchange.getRequestBody().readAllBytes().length);
            exchange.sendResponseHeaders(reply.get(), -1);
            exchange.close();
        });
        fakePushService.start();

        List<String> deleted = new ArrayList<>();
        PushSubscriptionRepository repository = (PushSubscriptionRepository) java.lang.reflect.Proxy.newProxyInstance(
                PushSubscriptionRepository.class.getClassLoader(), new Class<?>[]{PushSubscriptionRepository.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("deleteByEndpoint")) deleted.add((String) args[0]);
                    return null;
                });

        try {
            PushService service = new PushService(repository, null, KEYS);
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec("secp256r1"));
            byte[] browserKey = WebPushCrypto.uncompressed((ECPublicKey) generator.generateKeyPair().getPublic());
            String endpoint = "http://127.0.0.1:" + fakePushService.getAddress().getPort() + "/push/device-1";
            PushSubscription device = PushSubscription.builder()
                    .endpoint(endpoint)
                    .p256dh(Base64.getUrlEncoder().withoutPadding().encodeToString(browserKey))
                    .auth(Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]))
                    .build();
            byte[] payload = "{\"title\":\"amy\"}".getBytes(StandardCharsets.UTF_8);

            service.deliver(device, payload);
            assertTrue(authorization.get().startsWith("vapid t=") && authorization.get().endsWith(", k=" + KEYS.vapidPublicKey()),
                    authorization.get());
            assertEquals("aes128gcm", encoding.get());
            // salt(16) + record size(4) + key length(1) + our key(65) + payload + delimiter(1) + GCM tag(16)
            assertEquals(16 + 4 + 1 + 65 + payload.length + 1 + 16, bodyLength.get());
            assertTrue(deleted.isEmpty(), "a delivered push must not remove the device");

            reply.set(410);
            service.deliver(device, payload);
            assertEquals(List.of(endpoint), deleted);
        } finally {
            fakePushService.stop(0);
        }
    }

    private static MessageResponse text(String content) {
        return MessageResponse.builder().content(content).type("TEXT").build();
    }

    private static MessageResponse media(String mime) {
        return MessageResponse.builder().content("").attachment(Message.Attachment.builder().mimeType(mime).build()).build();
    }
}
