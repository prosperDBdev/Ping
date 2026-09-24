package com.example.pingBackend.service;

import com.example.pingBackend.exception.NotFoundException;
import com.example.pingBackend.exception.TooManyRequestsException;
import com.example.pingBackend.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The parts of invite links that don't need a database: the codes themselves,
 * the shape check, and the rate limit on the public preview.
 *
 * The service is built with a NULL MongoTemplate on purpose. Any test that
 * reached the database would crash with a NullPointerException, so a passing
 * test here also proves that the cheap checks turned the input away before any
 * query ran. The database behaviour (atomic replace, expiry, uniqueness) is
 * checked against a real MongoDB in the end-to-end run instead.
 */
class AppInviteServiceTest {

    /**
     * A repository that fails the test if anything calls it.
     *
     * Not simply null: the service passes userRepository::findById to an
     * Optional, and Java checks a method reference's target for null when the
     * reference is CREATED, even if the Optional is empty and it would never be
     * called. With null here the test would crash before testing anything.
     */
    private static UserRepository untouchableRepository() {
        return (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(), new Class<?>[]{UserRepository.class},
                (proxy, method, args) -> {
                    throw new AssertionError("the database should not have been queried: " + method.getName());
                });
    }

    @Test
    @DisplayName("a code is 22 URL-safe characters")
    void codeShape() {
        for (int i = 0; i < 1_000; i++) {
            String code = AppInviteService.newCode();
            assertEquals(22, code.length(), code);
            assertTrue(code.matches("[A-Za-z0-9_-]+"), "not URL-safe: " + code);
        }
    }

    @Test
    @DisplayName("codes don't repeat")
    void codesAreUnique() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 10_000; i++) {
            assertTrue(seen.add(AppInviteService.newCode()), "a code repeated");
        }
    }

    @Test
    @DisplayName("anything that can't be a code is rejected without touching the database")
    void malformedCodesNeverQuery() {
        AppInviteService service = new AppInviteService(null, null, null);

        for (String bad : new String[]{
                null, "", "short",
                "abcdefghijklmnopqrstu/",                 // 22 chars, but '/' isn't URL-safe
                "abcdefghijklmnopqrstuvw",                // 23 chars
                "../../../../../etc/passwd",
                "{\"$ne\": null}",                        // a NoSQL-injection-shaped value
                "x".repeat(500)}) {
            assertTrue(service.resolveInviter(bad).isEmpty(), "accepted: " + bad);
        }
    }

    @Test
    @DisplayName("the public preview is rate limited per IP")
    void previewIsRateLimited() {
        AppInviteService service = new AppInviteService(null, untouchableRepository(), new RateLimiter());

        // A malformed code still counts against the limit, which is exactly
        // what stops someone scanning with junk.
        for (int i = 0; i < 30; i++) {
            assertThrows(NotFoundException.class, () -> service.inviterUsername("nope", "203.0.113.9"));
        }
        assertThrows(TooManyRequestsException.class, () -> service.inviterUsername("nope", "203.0.113.9"));
    }

    @Test
    @DisplayName("one IP hitting the limit doesn't block anyone else")
    void previewLimitIsPerIp() {
        AppInviteService service = new AppInviteService(null, untouchableRepository(), new RateLimiter());

        for (int i = 0; i < 31; i++) {
            try {
                service.inviterUsername("nope", "203.0.113.9");
            } catch (RuntimeException ignored) {
                // exhausting the first IP's allowance
            }
        }
        assertThrows(NotFoundException.class, () -> service.inviterUsername("nope", "198.51.100.4"));
    }
}
