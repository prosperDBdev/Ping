package com.example.pingBackend.service;

import com.example.pingBackend.exception.GoneException;
import com.example.pingBackend.exception.BadRequestException;
import com.example.pingBackend.exception.TooManyRequestsException;
import com.example.pingBackend.model.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;

import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

/**
 * Switching two-step verification on and off from Settings (Stage 13).
 *
 * ON needs a code sent to your email first. Switching it on with an inbox
 * that doesn't actually receive Ping's emails would lock you out at your next
 * sign-in, so the feature proves the email arrives before it starts relying
 * on it.
 *
 * OFF needs your password. Otherwise anyone who picked up your unlocked phone
 * could quietly remove the protection.
 */
@Service
@RequiredArgsConstructor
public class TwoFactorService {

    private final LoginCodeService loginCodeService;
    private final PasswordEncoder passwordEncoder;
    private final RateLimiter rateLimiter;
    private final MongoTemplate mongoTemplate;

    public LoginCodeService.Issued start(User user) {
        return loginCodeService.issue(user, LoginCodeService.Purpose.ENABLE_TWO_FACTOR);
    }

    public void confirm(User user, String challenge, String code) {
        String owner = loginCodeService.verify(challenge, code, LoginCodeService.Purpose.ENABLE_TWO_FACTOR);
        if (!owner.equals(user.getId())) {
            // Someone else's challenge. Unreachable without guessing a 256-bit
            // value, but a code must only ever act for the account it was sent to.
            throw new GoneException("This code has expired. Start again.");
        }
        setEnabled(user, true);
    }

    public void disable(User user, String password) {
        if (!rateLimiter.tryAcquire("two-factor-off:user:" + user.getId(), 5, Duration.ofMinutes(15))) {
            throw new TooManyRequestsException("Too many attempts. Please wait 15 minutes and try again.");
        }
        if (password == null || !passwordEncoder.matches(password, user.getPassword())) {
            throw new BadRequestException("That password isn't right");
        }
        setEnabled(user, false);
    }

    /** One field, updated on its own, so nothing else on the account is rewritten. */
    private void setEnabled(User user, boolean enabled) {
        mongoTemplate.updateFirst(query(where("_id").is(user.getId())),
                new Update().set("twoFactorEnabled", enabled), User.class);
    }
}
