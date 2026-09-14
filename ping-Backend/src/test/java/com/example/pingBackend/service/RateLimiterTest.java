package com.example.pingBackend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The rate limiter, with a clock the test controls — so "wait an hour" takes
 * no time at all, and the tests can't flake on a slow machine.
 */
class RateLimiterTest {

    /** A clock that only moves when told to. */
    private static final class ManualClock extends Clock {
        private Instant now = Instant.parse("2026-09-14T12:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private ManualClock clock;
    private RateLimiter limiter;

    @BeforeEach
    void setUp() {
        clock = new ManualClock();
        limiter = new RateLimiter(clock);
    }

    @Test
    @DisplayName("allows up to the limit, then refuses")
    void allowsUpToLimit() {
        assertTrue(limiter.tryAcquire("k", 3, Duration.ofHours(1)));
        assertTrue(limiter.tryAcquire("k", 3, Duration.ofHours(1)));
        assertTrue(limiter.tryAcquire("k", 3, Duration.ofHours(1)));
        assertFalse(limiter.tryAcquire("k", 3, Duration.ofHours(1)));
    }

    @Test
    @DisplayName("different keys are counted separately")
    void keysAreIndependent() {
        for (int i = 0; i < 3; i++) limiter.tryAcquire("maya", 3, Duration.ofHours(1));
        assertFalse(limiter.tryAcquire("maya", 3, Duration.ofHours(1)));
        assertTrue(limiter.tryAcquire("sarah", 3, Duration.ofHours(1)));
    }

    @Test
    @DisplayName("the window slides: an attempt frees up exactly one window after it was made")
    void windowSlides() {
        limiter.tryAcquire("k", 2, Duration.ofHours(1));      // 12:00
        clock.advance(Duration.ofMinutes(30));
        limiter.tryAcquire("k", 2, Duration.ofHours(1));      // 12:30
        assertFalse(limiter.tryAcquire("k", 2, Duration.ofHours(1)));

        clock.advance(Duration.ofMinutes(31));                // 13:01 — the 12:00 attempt has aged out
        assertTrue(limiter.tryAcquire("k", 2, Duration.ofHours(1)));
        assertFalse(limiter.tryAcquire("k", 2, Duration.ofHours(1))); // but 12:30 still counts
    }

    @Test
    @DisplayName("no boundary burst: unlike a fixed hourly window, 3 at 12:59 and 3 at 13:00 is not allowed")
    void noBoundaryBurst() {
        clock.advance(Duration.ofMinutes(59));
        for (int i = 0; i < 3; i++) assertTrue(limiter.tryAcquire("k", 3, Duration.ofHours(1)));
        clock.advance(Duration.ofMinutes(1));
        assertFalse(limiter.tryAcquire("k", 3, Duration.ofHours(1)));
    }

    @Test
    @DisplayName("refused attempts don't count against the limit")
    void refusalsAreNotRecorded() {
        limiter.tryAcquire("k", 1, Duration.ofMinutes(10));
        for (int i = 0; i < 50; i++) limiter.tryAcquire("k", 1, Duration.ofMinutes(10));
        clock.advance(Duration.ofMinutes(11));
        assertTrue(limiter.tryAcquire("k", 1, Duration.ofMinutes(10)));
    }

    @Test
    @DisplayName("idle keys are evicted so invented keys can't grow memory forever")
    void evictsIdleKeys() {
        limiter.tryAcquire("old", 3, Duration.ofMinutes(10));
        clock.advance(Duration.ofHours(3));
        limiter.tryAcquire("fresh", 3, Duration.ofMinutes(10));
        limiter.evictIdleKeys();
        assertEquals(1, limiter.trackedKeys());
    }
}
