package com.example.pingBackend.service;

import com.example.pingBackend.exception.BadRequestException;
import com.example.pingBackend.exception.GoneException;
import com.example.pingBackend.exception.TooManyRequestsException;
import com.example.pingBackend.model.LoginCode;
import com.example.pingBackend.model.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.regex.Pattern;

import static org.springframework.data.mongodb.core.query.Criteria.where;
import static org.springframework.data.mongodb.core.query.Query.query;

/**
 * Emailed 6-digit codes: the second step of signing in, and the proof that
 * your inbox works before two-step verification is switched on (Stage 13).
 *
 * THE RULES, and what each one stops:
 *
 *   expires in 10 minutes      - an old email found later is useless
 *   5 wrong guesses, then gone - guessing: 5 tries out of a million is a
 *                                1-in-200,000 chance, then a new sign-in is needed
 *   single use                 - removed atomically on success, so the same
 *                                code can't be used twice, even simultaneously
 *   newest code wins           - asking again deletes the older code
 *   3 emails per challenge,
 *   30 seconds apart,
 *   6 challenges per hour      - someone who knows your password can't use
 *                                "send code" to flood your inbox or burn the
 *                                daily email quota
 */
@Service
public class LoginCodeService {

    public enum Purpose { LOGIN, ENABLE_TWO_FACTOR }

    /** What the browser gets back: which challenge, and where the code went. */
    public record Issued(String challenge, String emailHint) {
    }

    static final Duration CODE_LIFETIME = Duration.ofMinutes(10);
    static final int MAX_ATTEMPTS = 5;
    static final int MAX_SENDS = 3;
    static final Duration RESEND_GAP = Duration.ofSeconds(30);
    private static final Pattern SIX_DIGITS = Pattern.compile("^\\d{6}$");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final MongoTemplate mongoTemplate;
    private final EmailService emailService;
    private final RateLimiter rateLimiter;
    private final byte[] hmacKey;

    public LoginCodeService(MongoTemplate mongoTemplate, EmailService emailService, RateLimiter rateLimiter,
                            @Value("${jwt.secret}") String serverSecret) {
        this.mongoTemplate = mongoTemplate;
        this.emailService = emailService;
        this.rateLimiter = rateLimiter;
        // A key of its own, DERIVED from the server secret rather than reusing
        // it directly: the same secret used for two different jobs is a classic
        // mistake, and deriving costs nothing and needs no new setting.
        this.hmacKey = hmac(serverSecret.getBytes(StandardCharsets.UTF_8), "ping-login-codes-v1");
    }

    /** Create a code, email it, and return the challenge the browser keeps. */
    public Issued issue(User user, Purpose purpose) {
        if (!rateLimiter.tryAcquire("login-code:user:" + user.getId(), 6, Duration.ofHours(1))) {
            throw new TooManyRequestsException("Too many codes requested. Please wait a while and try again.");
        }

        // Newest code wins: an earlier email for the same purpose stops working.
        mongoTemplate.remove(query(where("userId").is(user.getId()).and("purpose").is(purpose.name())),
                LoginCode.class);

        String challenge = PasswordResetService.newToken();
        String challengeHash = PasswordResetService.sha256(challenge);
        String code = newCode();
        LocalDateTime now = LocalDateTime.now();

        mongoTemplate.insert(LoginCode.builder()
                .challengeHash(challengeHash)
                .userId(user.getId())
                .purpose(purpose.name())
                .codeHash(codeHash(challengeHash, code))
                .attempts(0)
                .sends(1)
                .lastSentAt(now)
                .expiresAt(now.plus(CODE_LIFETIME))
                .build());

        emailService.sendLoginCode(user.getEmail(), code, purpose == Purpose.LOGIN);
        return new Issued(challenge, emailHint(user.getEmail()));
    }

    /**
     * Send a NEW code for the same challenge. The old one stops working. The
     * limits are part of the update's condition, so two quick taps on "resend"
     * can't both get through.
     */
    public void resend(String challenge, User user, Purpose purpose) {
        String challengeHash = PasswordResetService.sha256(challenge);
        String code = newCode();
        LocalDateTime now = LocalDateTime.now();

        LoginCode updated = mongoTemplate.findAndModify(
                query(where("challengeHash").is(challengeHash)
                        .and("userId").is(user.getId())
                        .and("purpose").is(purpose.name())
                        .and("expiresAt").gt(now)
                        .and("sends").lt(MAX_SENDS)
                        .and("lastSentAt").lt(now.minus(RESEND_GAP))),
                new Update().set("codeHash", codeHash(challengeHash, code))
                        .inc("sends", 1)
                        .set("lastSentAt", now),
                LoginCode.class);

        if (updated == null) {
            throw new TooManyRequestsException(
                    "You can ask for a new code every 30 seconds, up to 3 times. Otherwise, start again.");
        }
        emailService.sendLoginCode(user.getEmail(), code, purpose == Purpose.LOGIN);
    }

    /** Whose challenge this is, for the sign-in step that has no user yet. */
    public String ownerOf(String challenge, Purpose purpose) {
        LoginCode found = mongoTemplate.findOne(
                query(where("challengeHash").is(PasswordResetService.sha256(challenge))
                        .and("purpose").is(purpose.name())
                        .and("expiresAt").gt(LocalDateTime.now())),
                LoginCode.class);
        if (found == null) {
            throw expired();
        }
        return found.getUserId();
    }

    /**
     * Check a typed code. Returns the user id it belongs to on success; the
     * code is gone afterwards. Throws on anything else.
     */
    public String verify(String challenge, String code, Purpose purpose) {
        if (code == null || !SIX_DIGITS.matcher(code.trim()).matches()) {
            throw new BadRequestException("Enter the 6-digit code from the email");
        }
        String challengeHash = PasswordResetService.sha256(challenge);

        // Count the attempt FIRST, atomically, and only if attempts remain.
        // Checking the code before counting would let a burst of simultaneous
        // guesses all be checked before any of them was counted.
        LoginCode current = mongoTemplate.findAndModify(
                query(where("challengeHash").is(challengeHash)
                        .and("purpose").is(purpose.name())
                        .and("expiresAt").gt(LocalDateTime.now())
                        .and("attempts").lt(MAX_ATTEMPTS)),
                new Update().inc("attempts", 1),
                FindAndModifyOptions.options().returnNew(true),
                LoginCode.class);

        if (current == null) {
            throw expired();
        }

        // Constant-time comparison: compares every byte whatever happens, so
        // how long a wrong answer takes reveals nothing about how close it was.
        boolean correct = MessageDigest.isEqual(
                codeHash(challengeHash, code.trim()).getBytes(StandardCharsets.UTF_8),
                current.getCodeHash().getBytes(StandardCharsets.UTF_8));

        if (correct) {
            // Single use: exactly one request can remove it.
            if (mongoTemplate.remove(query(where("_id").is(current.getId())), LoginCode.class)
                    .getDeletedCount() == 0) {
                throw expired();
            }
            return current.getUserId();
        }

        int left = MAX_ATTEMPTS - current.getAttempts();
        if (left <= 0) {
            mongoTemplate.remove(query(where("_id").is(current.getId())), LoginCode.class);
            throw new GoneException("Too many wrong codes. Start again to get a new one.");
        }
        throw new BadRequestException("That code isn't right. " + left + (left == 1 ? " try" : " tries") + " left.");
    }

    private static GoneException expired() {
        return new GoneException("This code has expired or was already used. Start again to get a new one.");
    }

    /** 000000 to 999999, every value equally likely. */
    static String newCode() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    /**
     * Bound to the challenge as well as the code, so the same six digits in
     * two different emails produce two different hashes.
     */
    String codeHash(String challengeHash, String code) {
        return HexFormat.of().formatHex(hmac(hmacKey, challengeHash + ":" + code));
    }

    /** "m•••@gmail.com": enough to recognise your own address, not to learn someone's. */
    static String emailHint(String email) {
        int at = email == null ? -1 : email.indexOf('@');
        if (at < 1) {
            return "your email";
        }
        return email.charAt(0) + "•••" + email.substring(at);
    }

    private static byte[] hmac(byte[] key, String message) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 is required by every Java runtime", e);
        }
    }
}
