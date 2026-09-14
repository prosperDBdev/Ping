package com.example.pingBackend.security;

import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Optional;

/**
 * The ONE place that turns a token into a user.
 *
 * Both doors into the app use this: the HTTP filter (every REST request) and
 * the WebSocket interceptor (every live connection). Before this existed, the
 * HTTP side checked tokens and the WebSocket side didn't check anything — it
 * believed whatever user id the browser claimed. Two doors with two different
 * locks is how that happens, so now there is one lock and both doors use it.
 *
 * A token is accepted only if ALL of these hold:
 *   1. the signature is valid and it hasn't expired
 *   2. the user it names still exists
 *   3. it was issued AFTER that user's password last changed
 *
 * Rule 3 is what makes "reset your password" also mean "log out everywhere".
 * Login tokens are stateless — the server keeps no list of them, so it can't
 * cancel one directly. What it CAN do is remember when the password changed
 * and refuse any token older than that. A thief holding a stolen token loses
 * access the moment the real owner resets their password.
 */
@Component
@RequiredArgsConstructor
public class TokenAuthenticator {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    public Optional<User> authenticate(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }

        Optional<Claims> claims = jwtTokenProvider.parseClaims(token);
        if (claims.isEmpty()) {
            return Optional.empty();
        }

        Date issuedAt = claims.get().getIssuedAt();
        return userRepository.findByUsername(claims.get().getSubject())
                .filter(user -> issuedAfterPasswordChange(user, issuedAt));
    }

    /**
     * JWT timestamps only have whole-second precision, but the password change
     * time has milliseconds. Comparing them directly would reject a token issued
     * in the same second the password changed — i.e. the user logging in right
     * after resetting would be bounced straight back out. So the change time is
     * rounded down to the second before comparing.
     */
    static boolean issuedAfterPasswordChange(User user, Date issuedAt) {
        LocalDateTime changedAt = user.getPasswordChangedAt();
        if (changedAt == null) {
            return true; // never changed — nothing to compare against
        }
        if (issuedAt == null) {
            return false; // fail closed: a token that won't say when it was made isn't trusted
        }
        Instant changedSecond = changedAt.atZone(ZoneId.systemDefault()).toInstant()
                .truncatedTo(ChronoUnit.SECONDS);
        return !issuedAt.toInstant().isBefore(changedSecond);
    }
}
