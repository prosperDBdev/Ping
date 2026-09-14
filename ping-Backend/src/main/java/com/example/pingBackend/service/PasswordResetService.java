package com.example.pingBackend.service;

import com.example.pingBackend.model.PasswordResetToken;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.PasswordResetTokenRepository;
import com.example.pingBackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Forgot password: request a link, then use it to set a new password.
 *
 * The four ideas that make this safe, each marked in the code below:
 *
 *   1. UNGUESSABLE TOKEN   32 random bytes from SecureRandom
 *   2. STORED AS A HASH    so a leaked database can't be turned into reset links
 *   3. SINGLE USE, EXPIRES claimed atomically and deleted; 15 minutes to live
 *   4. SAME ANSWER ALWAYS  the response never reveals whether an email exists
 *
 * Plus rate limiting on both steps, and "reset means log out everywhere".
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {

    /**
     * SecureRandom, never java.util.Random or Math.random. Those are designed to
     * be fast and statistically even, not unpredictable — someone who sees a few
     * of their outputs can work out the rest. SecureRandom draws on the operating
     * system's source of real randomness.
     */
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final RateLimiter rateLimiter;
    private final MongoTemplate mongoTemplate;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${password-reset.token-ttl-minutes:15}")
    private long tokenTtlMinutes;

    /**
     * Step 1: someone typed an email and asked for a reset link.
     *
     * IDEA 4 — this method returns nothing and throws nothing for an unknown
     * email. The controller sends the same "if that account exists, we've sent a
     * link" message either way. If it said "no account with that email", the form
     * would become a free tool for checking which emails are registered — which
     * attackers use to pick targets and to make phishing emails convincing.
     */
    public void requestReset(String submittedEmail, String clientIp) {
        String email = submittedEmail.trim().toLowerCase(Locale.ROOT);

        // Limits apply to the SUBMITTED email whether or not it exists, so being
        // rate limited doesn't reveal existence either. Per-email stops someone
        // flooding one person's inbox; per-IP stops one client hammering many
        // emails (and burning through the 300/day free email quota).
        if (!rateLimiter.tryAcquire("reset-request:ip:" + clientIp, 10, Duration.ofHours(1))
                || !rateLimiter.tryAcquire("reset-request:email:" + email, 3, Duration.ofHours(1))) {
            throw new TooManyRequestsException("Too many reset requests. Please try again later.");
        }

        findByEmailIgnoringCase(email).ifPresent(user -> {
            // Only the newest link should work. An older email sitting unread in
            // an inbox shouldn't stay usable after a fresh one was requested.
            tokenRepository.deleteByUserId(user.getId());

            String token = newToken();
            tokenRepository.save(PasswordResetToken.builder()
                    .userId(user.getId())
                    .tokenHash(sha256(token))                                     // IDEA 2
                    .expiresAt(LocalDateTime.now().plusMinutes(tokenTtlMinutes))  // IDEA 3
                    .build());

            emailService.sendPasswordReset(user.getEmail(),
                    frontendUrl + "/auth/reset-password?token=" + token);
        });
    }

    /**
     * Step 2: they clicked the link and chose a new password.
     */
    public void resetPassword(String token, String newPassword, String clientIp) {
        if (!rateLimiter.tryAcquire("reset-confirm:ip:" + clientIp, 10, Duration.ofMinutes(15))) {
            throw new TooManyRequestsException("Too many attempts. Please try again later.");
        }

        // IDEA 3 — find AND delete in one atomic database operation.
        //
        // The obvious version is "find the token, check it, then delete it". But
        // if the same link is submitted twice at nearly the same moment, both
        // requests can find it before either deletes it, and both succeed — so a
        // "single-use" link gets used twice. findAndRemove lets exactly one
        // request claim it; the other finds nothing. This is called a
        // check-then-act race, and "do the check and the change as one step" is
        // the general fix.
        PasswordResetToken claimed = mongoTemplate.findAndRemove(
                Query.query(Criteria.where("tokenHash").is(sha256(token))),
                PasswordResetToken.class);

        // Every failure below gives the SAME message. Distinguishing "never
        // existed" from "expired" from "already used" helps nobody but someone
        // probing tokens.
        if (claimed == null
                || claimed.getExpiresAt() == null
                || !claimed.getExpiresAt().isAfter(LocalDateTime.now())) {
            throw new InvalidPasswordResetException("This reset link is invalid or has expired.");
        }

        User user = userRepository.findById(claimed.getUserId())
                .orElseThrow(() -> new InvalidPasswordResetException("This reset link is invalid or has expired."));

        user.setPassword(passwordEncoder.encode(newPassword));
        // Every login token issued before this moment now stops working — see
        // TokenAuthenticator. If the reset was because the account was stolen,
        // the thief is logged out here.
        user.setPasswordChangedAt(LocalDateTime.now());
        userRepository.save(user);

        // Belt and braces: kill any other outstanding links for this account.
        tokenRepository.deleteByUserId(user.getId());

        log.info("Password reset completed for user {}", user.getId());
    }

    /** IDEA 1 — 32 random bytes is 256 bits: more combinations than atoms in the planet. */
    static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        // URL-safe Base64 so the token survives being put in a link untouched.
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * IDEA 2 — SHA-256, and deliberately NOT BCrypt.
     *
     * Passwords use BCrypt because people pick guessable passwords, and BCrypt is
     * designed to be SLOW so guessing millions of them takes forever. This token
     * isn't guessable — it's 256 random bits — so slowness buys nothing, and a
     * fast hash has one big advantage: the same token always produces the same
     * hash, so the database can look it up directly. (BCrypt salts each hash
     * differently, so you couldn't search for it at all.)
     */
    static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by every Java runtime", e);
        }
    }

    /**
     * Case-insensitive email lookup.
     *
     * Registration stores emails exactly as typed, so "Maya@X.com" and
     * "maya@x.com" are different strings in the database. Pattern.quote escapes
     * the input first: an email can contain characters like "+" and "." that
     * mean something in a regular expression, and without quoting,
     * "a.b@x.com" would also match "aXb@x.com".
     */
    private Optional<User> findByEmailIgnoringCase(String email) {
        Pattern exact = Pattern.compile("^" + Pattern.quote(email) + "$", Pattern.CASE_INSENSITIVE);
        return Optional.ofNullable(mongoTemplate.findOne(
                Query.query(Criteria.where("email").regex(exact)), User.class));
    }
}
