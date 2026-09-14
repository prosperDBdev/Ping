package com.example.pingBackend.service;

import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * Online status counted by connections.
 *
 * The bug being pinned down: closing ONE of several tabs used to mark the user
 * offline while the others were still open.
 */
class PresenceServiceTest {

    private final Map<String, User> users = new HashMap<>();
    private final List<Message<?>> broadcasts = new ArrayList<>();
    private PresenceService presence;

    @BeforeEach
    void setUp() {
        users.put("maya", User.builder().id("maya").username("maya").status("OFFLINE").build());

        UserRepository repo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(), new Class<?>[]{UserRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findById" -> Optional.ofNullable(users.get((String) args[0]));
                    case "save" -> {
                        User u = (User) args[0];
                        users.put(u.getId(), u);
                        yield u;
                    }
                    default -> throw new UnsupportedOperationException(method.getName());
                });

        MessageChannel channel = (message, timeout) -> broadcasts.add(message);
        presence = new PresenceService(repo, new SimpMessagingTemplate(channel), null);
    }

    private String status() {
        return users.get("maya").getStatus();
    }

    @Test
    @DisplayName("first connection makes the user ONLINE")
    void firstConnectionGoesOnline() {
        presence.connected("maya", "tab-1");
        assertEquals("ONLINE", status());
        assertEquals(1, broadcasts.size());
    }

    @Test
    @DisplayName("closing one of two tabs keeps the user ONLINE (the original bug)")
    void closingOneOfTwoTabsStaysOnline() {
        presence.connected("maya", "tab-1");
        presence.connected("maya", "tab-2");
        presence.disconnected("maya", "tab-1");

        assertEquals("ONLINE", status());
        assertEquals(1, presence.connectionCount("maya"));
    }

    @Test
    @DisplayName("closing the last connection makes the user OFFLINE and records last seen")
    void closingLastGoesOffline() {
        presence.connected("maya", "tab-1");
        presence.connected("maya", "tab-2");
        presence.disconnected("maya", "tab-1");
        presence.disconnected("maya", "tab-2");

        assertEquals("OFFLINE", status());
        assertNotNull(users.get("maya").getLastSeen());
        assertEquals(0, presence.connectionCount("maya"));
    }

    @Test
    @DisplayName("only changes are broadcast — extra tabs opening and closing are silent")
    void onlyTransitionsAreBroadcast() {
        presence.connected("maya", "tab-1");    // ONLINE  -> broadcast
        presence.connected("maya", "tab-2");    // still online
        presence.connected("maya", "tab-3");    // still online
        presence.disconnected("maya", "tab-2"); // still online
        presence.disconnected("maya", "tab-3"); // still online
        presence.disconnected("maya", "tab-1"); // OFFLINE -> broadcast

        assertEquals(2, broadcasts.size());
    }

    @Test
    @DisplayName("a duplicate disconnect event for the same connection changes nothing")
    void duplicateDisconnectIsHarmless() {
        presence.connected("maya", "tab-1");
        presence.connected("maya", "tab-2");
        presence.disconnected("maya", "tab-1");
        presence.disconnected("maya", "tab-1");

        assertEquals("ONLINE", status());
        assertEquals(1, presence.connectionCount("maya"));
    }

    @Test
    @DisplayName("reconnecting after going offline comes back ONLINE")
    void reconnectComesBackOnline() {
        presence.connected("maya", "tab-1");
        presence.disconnected("maya", "tab-1");
        presence.connected("maya", "tab-9");
        assertEquals("ONLINE", status());
    }
}
