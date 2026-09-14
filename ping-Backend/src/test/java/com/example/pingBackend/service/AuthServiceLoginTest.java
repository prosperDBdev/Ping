package com.example.pingBackend.service;

import com.example.pingBackend.dto.request.LoginRequest;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import com.example.pingBackend.security.JwtTokenProvider;
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

    @BeforeEach
    void setUp() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
        User maya = User.builder().id("maya-id").username("maya").email("maya@x.com")
                .password(encoder.encode("correct-horse")).build();
        Map<String, User> byUsername = Map.of("maya", maya);

        UserRepository repo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(), new Class<?>[]{UserRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findByUsername" -> Optional.ofNullable(byUsername.get((String) args[0]));
                    case "findByEmail" -> byUsername.values().stream()
                            .filter(u -> u.getEmail().equals(args[0])).findFirst();
                    default -> throw new UnsupportedOperationException(method.getName());
                });

        JwtTokenProvider jwt = new JwtTokenProvider(
                "test-only-signing-key-not-used-anywhere-real-0123456789abcdef", 86_400_000);

        auth = new AuthService(repo, encoder, jwt, new RateLimiter());
        auth.createDummyHash();
    }

    private void attempt(String username, String password, String ip) {
        LoginRequest request = new LoginRequest();
        request.setUsername(username);
        request.setPassword(password);
        auth.login(request, ip);
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
