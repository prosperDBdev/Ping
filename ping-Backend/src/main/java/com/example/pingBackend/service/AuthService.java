package com.example.pingBackend.service;

import com.example.pingBackend.dto.request.LoginRequest;
import com.example.pingBackend.dto.request.RegisterRequest;
import com.example.pingBackend.dto.response.AuthResponse;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import com.example.pingBackend.security.JwtTokenProvider;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final RateLimiter rateLimiter;

    // ------------------------------------------------------------------
    // Sign-in limits
    // ------------------------------------------------------------------

    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);

    /**
     * Three limits, because there are three different attacks and one limit
     * can't stop all of them without hurting real users:
     *
     *   same IP + same account, 5  — one attacker guessing one person's password.
     *                                Tight, and keyed to the IP too, so the attacker
     *                                gets locked out WITHOUT locking the real owner
     *                                out of their own account from their own phone.
     *
     *   same account, any IP, 20   — guessing spread across many machines to dodge
     *                                the first limit. Looser, because this one CAN
     *                                inconvenience the real owner.
     *
     *   same IP, any account, 50   — "credential stuffing": trying leaked
     *                                email/password pairs from other sites against
     *                                many accounts, a few tries each.
     */
    private record Limit(String key, int max) {
    }

    /**
     * A BCrypt hash of a random throwaway password, made once at startup with the
     * same encoder (same cost) as real passwords.
     *
     * Used when the username doesn't exist, so that check still takes as long as
     * a real one. Without it, "no such user" returns in about a millisecond and
     * "wrong password" takes ~100ms of BCrypt — and anyone measuring response
     * times could tell which usernames are registered.
     */
    private String dummyHash;

    @PostConstruct
    void createDummyHash() {
        dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    public AuthResponse register(RegisterRequest request) {

        // 1. Check if username already taken
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("Username is already taken");
        }

        // 2. Check if email already taken
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email is already in use");
        }

        // 3. Create new user with hashed password
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))  // ← Hash it!
                .build();

        // 4. Save to MongoDB
        User savedUser = userRepository.save(user);

        // 5. Generate JWT token
        String token = jwtTokenProvider.generateToken(savedUser.getUsername());

        // 6. Return response with token
        return AuthResponse.builder()
                .token(token)
                .id(savedUser.getId())
                .username(savedUser.getUsername())
                .email(savedUser.getEmail())
                .build();
    }

    public AuthResponse login(LoginRequest request, String clientIp) {
        // Lower-cased for the limit keys only, so "Maya" and "maya" share one
        // counter — otherwise varying the capitalisation would be a free way
        // around the limit. The actual lookup below is unchanged.
        String identifier = request.getUsername().trim().toLowerCase(Locale.ROOT);

        List<Limit> limits = List.of(
                new Limit("login:ip+account:" + clientIp + "|" + identifier, 5),
                new Limit("login:account:" + identifier, 20),
                new Limit("login:ip:" + clientIp, 50));

        // RESERVE a slot in every limit BEFORE checking the password.
        //
        // The tempting version — "if they've already failed 5 times, refuse; if
        // this attempt fails, record it" — has a gap: 100 guesses sent at the same
        // instant all pass the "failed fewer than 5 times?" check before any of
        // them has failed and been recorded. Reserving first (atomically) means
        // only 5 of those 100 ever reach the password check.
        List<String> reserved = new ArrayList<>();
        for (Limit limit : limits) {
            if (rateLimiter.tryAcquire(limit.key(), limit.max(), LOGIN_WINDOW)) {
                reserved.add(limit.key());
            } else {
                reserved.forEach(rateLimiter::release); // don't charge the limits that did pass
                // Refused before looking the account up at all — and without
                // running BCrypt, so a flood of attempts can't be used to burn
                // the server's CPU either.
                throw new TooManyRequestsException(
                        "Too many failed sign-in attempts. Please wait 15 minutes and try again.");
            }
        }

        Optional<User> user = userRepository.findByUsername(request.getUsername())
                .or(() -> userRepository.findByEmail(request.getUsername()));

        // Always runs BCrypt, whether or not the user exists — see dummyHash.
        boolean passwordMatches = passwordEncoder.matches(
                request.getPassword(), user.map(User::getPassword).orElse(dummyHash));

        if (user.isEmpty() || !passwordMatches) {
            // The reserved slots stay used: this was a real failed attempt. The
            // same exception and message for both cases, so the response never
            // says whether it was the username or the password that was wrong.
            throw new InvalidCredentialsException("Invalid username or password");
        }

        // Correct password: give back this attempt's slots, and clear this
        // device's failure history for the account — they've proven who they are.
        // The account-wide counter is NOT cleared: failures from other IPs may be
        // an attacker, and the owner signing in shouldn't wipe that record.
        reserved.forEach(rateLimiter::release);
        rateLimiter.reset(limits.get(0).key());

        String token = jwtTokenProvider.generateToken(user.get().getUsername());

        return AuthResponse.builder()
                .token(token)
                .id(user.get().getId())
                .username(user.get().getUsername())
                .email(user.get().getEmail())
                .build();
    }
}
