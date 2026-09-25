package com.example.pingBackend.security;

import com.example.pingBackend.model.LoginSession;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import com.example.pingBackend.service.SessionService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Stage 14: a token is only as good as the signed-in device it names.
 */
class SessionTokenTest {

    private static final String KEY = "test-only-signing-key-not-used-anywhere-real-0123456789abcdef";

    private final JwtTokenProvider jwt = new JwtTokenProvider(KEY, 86_400_000);
    private final Map<String, LoginSession> sessions = new HashMap<>();
    private TokenAuthenticator authenticator;

    @BeforeEach
    void setUp() {
        User maya = User.builder().id("maya-id").username("maya").build();
        UserRepository users = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(), new Class<?>[]{UserRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findById" -> "maya-id".equals(args[0]) ? Optional.of(maya) : Optional.empty();
                    default -> throw new UnsupportedOperationException(method.getName());
                });

        SessionService sessionService = new SessionService(null, null, jwt, null) {
            @Override
            public Optional<LoginSession> findActive(String sessionId) {
                return Optional.ofNullable(sessionId == null ? null : sessions.get(sessionId));
            }

            @Override
            public void touch(LoginSession session) {
            }
        };
        authenticator = new TokenAuthenticator(jwt, users, sessionService);
        sessions.put("phone", LoginSession.builder().id("phone").userId("maya-id")
                .expiresAt(LocalDateTime.now().plusDays(1)).build());
    }

    @Test
    @DisplayName("a token for a signed-in device is accepted, and says which device")
    void liveSessionIsAccepted() {
        var signedIn = authenticator.authenticateSession(jwt.generateToken("maya", "phone"));
        assertTrue(signedIn.isPresent());
        assertEquals("maya-id", signedIn.get().user().getId());
        assertEquals("phone", signedIn.get().sessionId());
    }

    @Test
    @DisplayName("once the device is signed out, its token stops working immediately")
    void revokedSessionIsRefused() {
        String token = jwt.generateToken("maya", "phone");
        sessions.remove("phone");
        assertTrue(authenticator.authenticate(token).isEmpty());
    }

    @Test
    @DisplayName("tokens from before sessions existed (no session id) are refused")
    void legacyTokenIsRefused() {
        String legacy = Jwts.builder()
                .subject("maya")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(Keys.hmacShaKeyFor(KEY.getBytes(StandardCharsets.UTF_8)))
                .compact();
        assertTrue(authenticator.authenticate(legacy).isEmpty());
    }

    @Test
    @DisplayName("the user comes from the session, so a token can't claim someone else's device")
    void sessionDecidesTheUser() {
        sessions.put("ghost", LoginSession.builder().id("ghost").userId("deleted-user")
                .expiresAt(LocalDateTime.now().plusDays(1)).build());
        assertTrue(authenticator.authenticate(jwt.generateToken("maya", "ghost")).isEmpty());
    }

    @Test
    @DisplayName("device names are for people to read, and never break on odd input")
    void deviceNames() {
        assertEquals("Chrome on Android", DeviceNames.describe(
                "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36"));
        assertEquals("Safari on iPhone", DeviceNames.describe(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"));
        assertEquals("Edge on Windows", DeviceNames.describe(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0"));
        assertEquals("Unknown device", DeviceNames.describe(null));
        assertEquals("A browser on an unknown system", DeviceNames.describe("curl/8.0"));
    }
}
