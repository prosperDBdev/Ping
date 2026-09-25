package com.example.pingBackend.service;

import com.example.pingBackend.dto.request.RegisterRequest;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Registration attribution (Stage 12).
 *
 * The rule under test: an invite link can only ever ADD information to a
 * sign-up. A good code records who invited the new user; a bad, expired or
 * missing code changes nothing and never stops the account being created.
 */
class AuthServiceRegisterInviteTest {

    private static final String GOOD_CODE = "AAAAAAAAAAAAAAAAAAAAAA";

    private final List<User> saved = new ArrayList<>();
    private AuthService auth;

    @BeforeEach
    void setUp() {
        UserRepository repo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(), new Class<?>[]{UserRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "existsByUsername", "existsByEmailIgnoringCase" -> false;
                    case "save" -> {
                        User u = (User) args[0];
                        u.setId("new-" + saved.size());
                        saved.add(u);
                        yield u;
                    }
                    default -> throw new UnsupportedOperationException(method.getName());
                });

        // Stands in for the real lookup: one code is live and belongs to Maya,
        // everything else is unknown or expired.
        AppInviteService invites = new AppInviteService(null, null, null) {
            @Override
            public Optional<String> resolveInviter(String code) {
                return GOOD_CODE.equals(code) ? Optional.of("maya-id") : Optional.empty();
            }
        };

        auth = new AuthService(repo, new BCryptPasswordEncoder(4), new RateLimiter(), invites, new FakeSessions(), null);
    }

    private static RegisterRequest request(String inviteCode) {
        RegisterRequest r = new RegisterRequest();
        r.setUsername("sam");
        r.setEmail("sam@example.com");
        r.setPassword("password123");
        r.setInviteCode(inviteCode);
        return r;
    }

    @Test
    @DisplayName("signing up through a live invite records who invited you")
    void liveInviteIsAttributed() {
        auth.register(request(GOOD_CODE), "test");
        assertEquals("maya-id", saved.get(0).getInvitedBy());
    }

    @Test
    @DisplayName("an expired or unknown invite still lets you sign up, just without attribution")
    void deadInviteStillRegisters() {
        assertDoesNotThrow(() -> auth.register(request("ZZZZZZZZZZZZZZZZZZZZZZ"), "test"));
        assertNull(saved.get(0).getInvitedBy());
    }

    @Test
    @DisplayName("signing up with no invite at all works as it always did")
    void noInvite() {
        auth.register(request(null), "test");
        assertNull(saved.get(0).getInvitedBy());
    }
}
