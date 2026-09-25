package com.example.pingBackend.controller;

import com.example.pingBackend.dto.response.ConversationResponse;
import com.example.pingBackend.dto.response.UserResponse;
import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import com.example.pingBackend.service.BlockService;
import com.example.pingBackend.service.ConversationService;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Other people's email addresses must never reach the client.
 *
 * THE BUG THIS PINS DOWN. Every UserResponse used to carry an email, and three
 * endpoints handed UserResponses for OTHER users to anyone signed in: search,
 * GET /api/users/{id}, and every conversation's participant list. Searching for
 * single letters harvested addresses in bulk. It was found while documenting the
 * app's security controls, before any tester saw it.
 *
 * The one legitimate case, your own profile, is checked too, so a fix that
 * simply deleted the field would fail here as well.
 */
class EmailPrivacyTest {

    private final Map<String, User> users = new HashMap<>();
    private User alice;
    private User bob;
    private UserController controller;
    private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        alice = user("alice-id", "alice", "alice@private.test");
        bob = user("bob-id", "bob", "bob@private.test");

        userRepository = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(), new Class<?>[]{UserRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findById" -> Optional.ofNullable(users.get((String) args[0]));
                    case "findByUsernameContainingIgnoreCase" -> users.values().stream()
                            .filter(u -> u.getUsername().contains(((String) args[0]).toLowerCase()))
                            .toList();
                    default -> throw new UnsupportedOperationException(method.getName());
                });

        // AvatarService isn't touched by these endpoints, so it can be null.
        controller = new UserController(userRepository, new BlockService(userRepository), null);
    }

    private User user(String id, String username, String email) {
        User u = User.builder().id(id).username(username).email(email)
                .blockedUsers(new ArrayList<>()).hiddenStatusFrom(new ArrayList<>()).build();
        users.put(id, u);
        return u;
    }

    @Test
    @DisplayName("search results never include other users' email addresses")
    void searchHidesEmails() {
        List<UserResponse> results = controller.searchUsers("b", alice).getBody();

        assertEquals(1, results.size(), "bob should be found");
        assertNull(results.get(0).getEmail());
    }

    @Test
    @DisplayName("looking up another user by id doesn't reveal their email")
    void profileByIdHidesEmail() {
        assertNull(controller.getUserById("bob-id").getBody().getEmail());
    }

    @Test
    @DisplayName("your own profile still shows your own email")
    void ownProfileShowsOwnEmail() {
        assertEquals("alice@private.test", controller.getCurrentUser(alice).getBody().getEmail());
    }

    @Test
    @DisplayName("a conversation's participant list carries no email addresses")
    void participantsHideEmails() {
        ConversationService conversations =
                new ConversationService(null, userRepository, null, null, null, null, null);
        Conversation chat = Conversation.builder()
                .id("c1").type("PRIVATE")
                .participants(new ArrayList<>(List.of("alice-id", "bob-id")))
                .build();

        ConversationResponse response = conversations.mapToResponse(chat, "alice-id");

        response.getParticipants().forEach(p -> assertNull(p.getEmail(), p.getUsername()));
    }

    @Test
    @DisplayName("a missing email is left out of the JSON entirely, not sent as null")
    void emailKeyOmittedFromJson() throws Exception {
        UserResponse other = controller.getUserById("bob-id").getBody();

        // The same Jackson 3 Spring Boot 4 uses to write real responses.
        String json = JsonMapper.builder().build().writeValueAsString(other);

        assertFalse(json.contains("email"), json);
    }
}
