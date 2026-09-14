package com.example.pingBackend.security;

import com.example.pingBackend.model.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * "Reset your password" must also mean "every old login stops working".
 */
class TokenAuthenticatorTest {

    private static Date at(LocalDateTime time) {
        return Date.from(time.atZone(ZoneId.systemDefault()).toInstant());
    }

    private static User userChangedPasswordAt(LocalDateTime time) {
        return User.builder().id("u").username("u").passwordChangedAt(time).build();
    }

    @Test
    @DisplayName("a user who never changed their password: any valid token is fine")
    void neverChanged() {
        User user = User.builder().id("u").username("u").build();
        assertTrue(TokenAuthenticator.issuedAfterPasswordChange(user, at(LocalDateTime.now())));
    }

    @Test
    @DisplayName("a token issued BEFORE the password changed is rejected — a stolen token dies here")
    void oldTokenRejected() {
        LocalDateTime changed = LocalDateTime.of(2026, 9, 14, 12, 0, 0);
        assertFalse(TokenAuthenticator.issuedAfterPasswordChange(
                userChangedPasswordAt(changed), at(changed.minusMinutes(5))));
    }

    @Test
    @DisplayName("a token issued AFTER the change (the new login) is accepted")
    void newTokenAccepted() {
        LocalDateTime changed = LocalDateTime.of(2026, 9, 14, 12, 0, 0);
        assertTrue(TokenAuthenticator.issuedAfterPasswordChange(
                userChangedPasswordAt(changed), at(changed.plusSeconds(3))));
    }

    @Test
    @DisplayName("same second: logging in right after a reset isn't bounced out by JWT's second-precision clock")
    void sameSecondAccepted() {
        LocalDateTime changed = LocalDateTime.of(2026, 9, 14, 12, 0, 0, 750_000_000); // 12:00:00.750
        LocalDateTime issued = LocalDateTime.of(2026, 9, 14, 12, 0, 0);               // JWT rounds down to 12:00:00
        assertTrue(TokenAuthenticator.issuedAfterPasswordChange(userChangedPasswordAt(changed), at(issued)));
    }

    @Test
    @DisplayName("a token with no issued-at time is rejected once a password change exists (fail closed)")
    void missingIssuedAtRejected() {
        assertFalse(TokenAuthenticator.issuedAfterPasswordChange(
                userChangedPasswordAt(LocalDateTime.now()), null));
    }
}
