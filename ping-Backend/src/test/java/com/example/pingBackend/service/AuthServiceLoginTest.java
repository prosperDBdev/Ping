package com.example.pingBackend.service;

import com.example.pingBackend.dto.request.LoginRequest;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import com.example.pingBackend.dto.response.AuthResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import com.example.pingBackend.exception.TooManyRequestsException;
import com.example.pingBackend.exception.InvalidCredentialsException;

/**
 * Sign-in rate limiting.
 *
 * Uses a real BCrypt encoder (at the lowest cost, so the suite stays fast) and a
 * real rate limiter — the behaviour under test is how those two interact.
 */
class AuthServiceLoginTest {

    private static final String IP_A = "203.0.113.1";
    private static final String IP_B = "203.0.113.2";

    private AuthService auth;
    private FakeSessions sessions;
    private final List<String> codesSentTo = new ArrayList<>();

    @BeforeEach
    void setUp() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
        User maya = User.builder().id("maya-id").username("maya").email("maya@x.com")
                .password(encoder.encode("correct-horse")).build();
        User theo = User.builder().id("theo-id").username("theo").email("theo@x.com")
                .password(encoder.encode("correct-horse")).twoFactorEnabled(true).build();
        Map<String, User> byUsername = Map.of("maya", maya, "theo", theo);

        UserRepository repo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(), new Class<?>[]{UserRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findByUsername" -> Optional.ofNullable(byUsername.get((String) args[0]));
                    case "findByEmail" -> byUsername.values().stream()
                            .filter(u -> u.getEmail().equals(args[0])).findFirst();
                    default -> throw new UnsupportedOperationException(method.getName());
                });

        // Records who was sent a code, instead of emailing anyone.
        LoginCodeService codes = new LoginCodeService(null, null, new RateLimiter(), FakeSessions.SIGNING_KEY) {
            @Override
            public Issued issue(User user, Purpose purpose) {
                codesSentTo.add(user.getId());
                return new Issued("pending-challenge", "t•••@x.com");
            }
        };
        sessions = new FakeSessions();

        // Sign-in never touches invites, so the invite service isn't needed.
        auth = new AuthService(repo, encoder, new RateLimiter(), null, sessions, codes);
        auth.createDummyHash();
    }

    private void attempt(String username, String password, String ip) {
        LoginRequest request = new LoginRequest();
        request.setUsername(username);
        request.setPassword(password);
        auth.login(request, ip, "test");
    }

    private AuthResponse signIn(String username) {
        LoginRequest request = new LoginRequest();
        request.setUsername(username);
        request.setPassword("correct-horse");
        return auth.login(request, IP_A, "test");
    }

    @Test
    @DisplayName("without two-step verification, the right password signs you in on a new session")
    void plainSignInIssuesASession() {
        AuthResponse response = signIn("maya");
        assertEquals(true, response.getToken() != null);
        assertEquals(List.of("PASSWORD"), sessions.methods);
        assertEquals(List.of(), codesSentTo);
    }

    @Test
    @DisplayName("with two-step verification, the right password alone gets a code emailed and NO token")
    void twoFactorWithholdsTheToken() {
        AuthResponse response = signIn("theo");
        assertEquals(null, response.getToken());
        assertEquals(true, response.getTwoFactorRequired());
        assertEquals("pending-challenge", response.getChallenge());
        assertEquals(List.of("theo-id"), codesSentTo);
        assertEquals(List.of(), sessions.methods, "no session may exist before the code is entered");
    }

    @Test
    @DisplayName("a wrong password never sends a code, even with two-step verification on")
    void wrongPasswordSendsNoCode() {
        assertThrows(InvalidCredentialsException.class, () -> attempt("theo", "nope", IP_A));
        assertEquals(List.of(), codesSentTo);
    }

    @Test
    @DisplayName("wrong password and unknown user fail the same way — nothing reveals which usernames exist")
    void failuresLookIdentical() {
        InvalidCredentialsException wrong = assertThrows(InvalidCredentialsException.class,
                () -> attempt("maya", "nope", IP_A));
        InvalidCredentialsException unknown = assertThrows(InvalidCredentialsException.class,
                () -> attempt("nobody", "nope", IP_A));
        assertEquals(wrong.getMessage(), unknown.getMessage());
    }

    @Test
    @DisplayName("after 5 failures from one IP, that IP is blocked for that account — even with the right password")
    void blockedAfterFive() {
        for (int i = 0; i < 5; i++) {
            assertThrows(InvalidCredentialsException.class, () -> attempt("maya", "nope", IP_A));
        }
        // Blocked before the password is even checked — otherwise the limit would
        // only slow guessing down until a guess happened to be right.
        assertThrows(TooManyRequestsException.class, () -> attempt("maya", "correct-horse", IP_A));
    }

    @Test
    @DisplayName("an attacker on one IP doesn't lock the real owner out from their own device")
    void ownerOnAnotherIpStillSignsIn() {
        for (int i = 0; i < 5; i++) {
            assertThrows(InvalidCredentialsException.class, () -> attempt("maya", "nope", IP_A));
        }
        assertDoesNotThrow(() -> attempt("maya", "correct-horse", IP_B));
    }

    @Test
    @DisplayName("capitalisation doesn't give a fresh counter")
    void caseDoesNotBypass() {
        for (int i = 0; i < 5; i++) {
            final String name = i % 2 == 0 ? "MAYA" : "Maya";
            assertThrows(InvalidCredentialsException.class, () -> attempt(name, "nope", IP_A));
        }
        assertThrows(TooManyRequestsException.class, () -> attempt("maya", "nope", IP_A));
    }

    @Test
    @DisplayName("a successful sign-in doesn't use up the allowance, and clears that device's failures")
    void successDoesNotCount() {
        for (int i = 0; i < 4; i++) {
            assertThrows(InvalidCredentialsException.class, () -> attempt("maya", "nope", IP_A));
        }
        assertDoesNotThrow(() -> attempt("maya", "correct-horse", IP_A));
        // Fresh start for this device: five more wrong tries are allowed.
        for (int i = 0; i < 5; i++) {
            assertThrows(InvalidCredentialsException.class, () -> attempt("maya", "nope", IP_A));
        }
    }

    @Test
    @DisplayName("100 simultaneous guesses: only 5 ever reach the password check (no check-then-act race)")
    void burstCannotSlipPastTheLimit() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(32);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<String>> results = new ArrayList<>();

        for (int i = 0; i < 100; i++) {
            results.add(pool.submit(() -> {
                start.await();
                try {
                    attempt("maya", "nope", IP_A);
                    return "ok";
                } catch (InvalidCredentialsException e) {
                    return "checked";
                } catch (TooManyRequestsException e) {
                    return "blocked";
                }
            }));
        }
        start.countDown();

        int checked = 0;
        for (Future<String> f : results) {
            if (f.get(10, TimeUnit.SECONDS).equals("checked")) checked++;
        }
        pool.shutdown();

        assertEquals(5, checked, "exactly 5 guesses should have been checked against the password");
    }

    @Test
    @DisplayName("the same IP trying many different accounts is cut off at 50 (credential stuffing)")
    void stuffingAcrossAccounts() {
        for (int i = 0; i < 50; i++) {
            final String name = "victim" + i;
            assertThrows(InvalidCredentialsException.class, () -> attempt(name, "leaked", IP_A));
        }
        assertThrows(TooManyRequestsException.class, () -> attempt("victim-51", "leaked", IP_A));
    }
}
