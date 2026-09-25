package com.example.pingBackend.service;

import com.example.pingBackend.exception.GoneException;
import com.example.pingBackend.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Stage 14: QR sign-in codes are single use and belong to one waiting computer. */
class PairingServiceTest {

    private final User maya = User.builder().id("maya-id").username("maya").email("maya@x.com").build();
    private FakeSessions sessions;
    private PairingService pairing;

    @BeforeEach
    void setUp() {
        sessions = new FakeSessions();
        pairing = new PairingService(sessions);
    }

    /** A pretend computer's socket that records what the server sent it. */
    private static WebSocketSession computer(List<String> received) throws Exception {
        WebSocketSession socket = mock(WebSocketSession.class);
        when(socket.getId()).thenReturn("socket-" + System.nanoTime());
        when(socket.isOpen()).thenReturn(true);
        doAnswer(inv -> {
            received.add(((TextMessage) inv.getArgument(0)).getPayload());
            return null;
        }).when(socket).sendMessage(any());
        return socket;
    }

    private static String codeFrom(List<String> received) {
        String first = received.get(0);
        int start = first.indexOf("\"code\":\"") + 8;
        return first.substring(start, first.indexOf('"', start));
    }

    @Test
    @DisplayName("approving sends the computer a token for a new QR session, named after the computer")
    void approveSignsTheComputerIn() throws Exception {
        List<String> received = new ArrayList<>();
        pairing.open(computer(received), "Chrome on Windows");
        String code = codeFrom(received);

        assertEquals("Chrome on Windows", pairing.deviceFor(code));
        pairing.approve(code, maya);

        assertEquals(List.of("QR"), sessions.methods);
        assertTrue(received.get(1).contains("\"type\":\"approved\""));
        assertTrue(received.get(1).contains("\"token\":\""));
    }

    @Test
    @DisplayName("a code works once, even when approved twice at the same moment")
    void singleUseUnderRace() throws Exception {
        List<String> received = new ArrayList<>();
        pairing.open(computer(received), "Chrome on Windows");
        String code = codeFrom(received);

        ExecutorService pool = Executors.newFixedThreadPool(8);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger approved = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            futures.add(pool.submit(() -> {
                start.await();
                try {
                    pairing.approve(code, maya);
                    approved.incrementAndGet();
                } catch (GoneException expected) {
                    // the losers of the race
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> f : futures) f.get(5, TimeUnit.SECONDS);
        pool.shutdown();

        assertEquals(1, approved.get());
        assertEquals(1, sessions.methods.size());
    }

    @Test
    @DisplayName("an unknown code, or one whose computer left, can't be looked up or approved")
    void deadCodesAreRefused() throws Exception {
        assertThrows(GoneException.class, () -> pairing.deviceFor("made-up"));
        assertThrows(GoneException.class, () -> pairing.approve("made-up", maya));
        assertThrows(GoneException.class, () -> pairing.approve(null, maya));

        List<String> received = new ArrayList<>();
        WebSocketSession socket = computer(received);
        pairing.open(socket, "Chrome on Windows");
        String code = codeFrom(received);
        pairing.forget(socket);
        assertThrows(GoneException.class, () -> pairing.approve(code, maya));
        assertEquals(0, sessions.methods.size());
    }

    @Test
    @DisplayName("denying tells the computer, and the code can't be used afterwards")
    void denyEndsIt() throws Exception {
        List<String> received = new ArrayList<>();
        pairing.open(computer(received), "Chrome on Windows");
        String code = codeFrom(received);

        pairing.deny(code);
        assertTrue(received.get(1).contains("\"type\":\"denied\""));
        assertThrows(GoneException.class, () -> pairing.approve(code, maya));
        assertFalse(received.stream().anyMatch(m -> m.contains("token")));
    }

    @Test
    @DisplayName("codes are long random values, different every time")
    void codesAreUnguessable() throws Exception {
        var codes = ConcurrentHashMap.<String>newKeySet();
        for (int i = 0; i < 50; i++) {
            List<String> received = new ArrayList<>();
            pairing.open(computer(received), "x");
            String code = codeFrom(received);
            assertTrue(code.length() >= 43, "256 bits of randomness");
            codes.add(code);
        }
        assertEquals(50, codes.size());
    }
}
