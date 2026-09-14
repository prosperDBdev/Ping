package com.example.pingBackend.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * A sliding-window rate limiter: "at most N attempts in the last X minutes".
 *
 * HOW IT WORKS. For each key (e.g. "reset-request:email:maya@x.com") it keeps
 * the timestamps of recent attempts. On each new attempt it first throws away
 * any timestamps older than the window, then counts what's left. Under the
 * limit: record this attempt and allow it. At the limit: refuse.
 *
 * "Sliding" matters. A simpler fixed window ("3 per clock hour") resets at the
 * top of the hour, so someone could do 3 at 12:59 and 3 more at 13:00 — six in
 * two minutes. A sliding window always looks back exactly one window from now.
 *
 * WHY WRITE ONE rather than add a library: the whole idea is about twenty lines,
 * and it's worth being able to see all of it. The limits of this version:
 *   - it lives in memory, so a restart clears it (acceptable — an attacker
 *     can't restart your server)
 *   - it's per server instance; several instances would each count separately
 *     and would need a shared store like Redis
 *
 * MEMORY. Every distinct key costs memory, and an attacker can invent keys
 * (a new fake email per request). Two defences: the per-IP limits cap how fast
 * one client can create keys, and evictIdleKeys drops keys nobody has used
 * recently so the map can't grow forever.
 */
@Component
public class RateLimiter {

    /** Longer than any window used, so eviction never drops a key that still matters. */
    private static final Duration IDLE_EVICTION = Duration.ofHours(2);

    private final Map<String, Deque<Long>> attempts = new ConcurrentHashMap<>();
    private final Clock clock;

    public RateLimiter() {
        this(Clock.systemUTC());
    }

    /** For tests: lets time be moved forward without actually waiting. */
    RateLimiter(Clock clock) {
        this.clock = clock;
    }

    /**
     * Try to use one attempt. Returns false if the limit is already reached.
     *
     * Done inside compute() so two requests for the same key arriving together
     * can't both read "2 of 3 used" and both be allowed — a check-then-act race
     * that would let a burst of parallel requests slip past the limit.
     */
    public boolean tryAcquire(String key, int limit, Duration window) {
        long now = clock.millis();
        long windowStart = now - window.toMillis();
        boolean[] allowed = {false};

        attempts.compute(key, (k, existing) -> {
            Deque<Long> recent = existing != null ? existing : new ArrayDeque<>();
            while (!recent.isEmpty() && recent.peekFirst() <= windowStart) {
                recent.pollFirst();
            }
            if (recent.size() < limit) {
                recent.addLast(now);
                allowed[0] = true;
            }
            return recent;
        });

        return allowed[0];
    }

    /**
     * Give back one attempt that turned out not to count.
     *
     * Used for sign-in: every attempt reserves a slot up front (so a burst of
     * simultaneous guesses can't all squeeze past the limit), and an attempt
     * that SUCCEEDS hands its slot back — a person typing the right password
     * shouldn't use up their allowance for wrong ones.
     */
    public void release(String key) {
        attempts.computeIfPresent(key, (k, recent) -> {
            recent.pollLast();
            return recent.isEmpty() ? null : recent;
        });
    }

    /** Forget a key's history entirely. */
    public void reset(String key) {
        attempts.remove(key);
    }

    @Scheduled(fixedRate = 600_000) // every 10 minutes
    public void evictIdleKeys() {
        long cutoff = clock.millis() - IDLE_EVICTION.toMillis();
        for (String key : attempts.keySet()) {
            attempts.computeIfPresent(key, (k, recent) ->
                    recent.isEmpty() || recent.peekLast() <= cutoff ? null : recent);
        }
    }

    int trackedKeys() {
        return attempts.size();
    }
}
