package com.example.pingBackend.service;

import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests for the blocking rule.
 *
 * Worth testing rather than eyeballing: this one method decides what "blocked"
 * means everywhere in the app, and both of its important properties (symmetry,
 * failing closed) are the kind that can be broken by a well-meaning
 * simplification without anything obviously breaking.
 */
class BlockServiceTest {

    /**
     * Hand-rolled in-memory repository rather than a mocking framework — the
     * only methods used are findById and save, and a real map makes the tests
     * read as data rather than as stubbing instructions.
     */
    private static class InMemoryUserRepository implements UserRepositoryStub {
        final Map<String, User> users = new HashMap<>();

        @Override
        public Optional<User> findById(String id) {
            return Optional.ofNullable(users.get(id));
        }

        @Override
        public User save(User user) {
            users.put(user.getId(), user);
            return user;
        }
    }

    private InMemoryUserRepository repo;
    private BlockService service;

    private User user(String id, List<String> blocked) {
        return User.builder().id(id).username(id).blockedUsers(blocked).build();
    }

    @BeforeEach
    void setUp() {
        repo = new InMemoryUserRepository();
        service = new BlockService(UserRepositoryStub.asRepository(repo));
    }

    @Test
    @DisplayName("two users with no blocks can interact")
    void notBlockedByDefault() {
        repo.users.put("a", user("a", new ArrayList<>()));
        repo.users.put("b", user("b", new ArrayList<>()));

        assertFalse(service.isBlockedBetween("a", "b"));
    }

    @Test
    @DisplayName("blocking is symmetric — the blocker is stopped too")
    void symmetric() {
        // A blocks B. B obviously can't message A — but the case that actually
        // matters is that A can't message B either. A one-directional check
        // would leave the blocker free to keep contacting the person they
        // blocked, which defeats the entire feature.
        repo.users.put("a", user("a", new ArrayList<>(List.of("b"))));
        repo.users.put("b", user("b", new ArrayList<>()));

        assertTrue(service.isBlockedBetween("b", "a"), "blocked user must be stopped");
        assertTrue(service.isBlockedBetween("a", "b"), "blocker must be stopped as well");
    }

    @Test
    @DisplayName("fails closed when a user doesn't exist")
    void failsClosedOnMissingUser() {
        repo.users.put("a", user("a", new ArrayList<>()));
        // "ghost" was never created — a deleted account, a stale reference, a
        // bad id. None of those are permission to deliver a message.
        assertTrue(service.isBlockedBetween("a", "ghost"));
        assertTrue(service.isBlockedBetween("ghost", "a"));
    }

    @Test
    @DisplayName("fails closed on a null id")
    void failsClosedOnNull() {
        repo.users.put("a", user("a", new ArrayList<>()));
        assertTrue(service.isBlockedBetween("a", null));
        assertTrue(service.isBlockedBetween(null, "a"));
    }

    @Test
    @DisplayName("tolerates a null blockedUsers list from an older document")
    void tolerationOfLegacyDocuments() {
        // Users created before blocking shipped have no blockedUsers key at
        // all. @Builder.Default doesn't help — it only applies when the
        // builder constructs the object, not when Mongo deserialises one.
        repo.users.put("a", user("a", null));
        repo.users.put("b", user("b", null));

        assertFalse(service.isBlockedBetween("a", "b"));
    }

    @Test
    @DisplayName("a user is never blocked from themselves")
    void selfIsNeverBlocked() {
        repo.users.put("a", user("a", new ArrayList<>()));
        assertFalse(service.isBlockedBetween("a", "a"));
    }

    @Test
    @DisplayName("blocking an already-blocked user doesn't duplicate the entry")
    void blockIsIdempotent() {
        repo.users.put("a", user("a", new ArrayList<>()));
        repo.users.put("b", user("b", new ArrayList<>()));

        service.block("a", "b");
        service.block("a", "b");

        assertTrue(repo.users.get("a").getBlockedUsers().size() == 1);
    }

    @Test
    @DisplayName("unblock restores the ability to interact")
    void unblockWorks() {
        repo.users.put("a", user("a", new ArrayList<>()));
        repo.users.put("b", user("b", new ArrayList<>()));

        service.block("a", "b");
        assertTrue(service.isBlockedBetween("a", "b"));

        service.unblock("a", "b");
        assertFalse(service.isBlockedBetween("a", "b"));
    }

    @Test
    @DisplayName("you can't block yourself")
    void cannotBlockSelf() {
        repo.users.put("a", user("a", new ArrayList<>()));
        assertThrows(RuntimeException.class, () -> service.block("a", "a"));
    }

    @Test
    @DisplayName("assertNotBlocked throws BlockedUserException, mapped to 403")
    void assertThrowsBlockedException() {
        repo.users.put("a", user("a", new ArrayList<>(List.of("b"))));
        repo.users.put("b", user("b", new ArrayList<>()));

        assertThrows(BlockedUserException.class, () -> service.assertNotBlocked("a", "b"));
    }

    /**
     * Narrow view of UserRepository so the fake only has to implement what
     * BlockService actually uses, rather than every inherited Mongo method.
     */
    interface UserRepositoryStub {
        Optional<User> findById(String id);

        User save(User user);

        static UserRepository asRepository(UserRepositoryStub stub) {
            return (UserRepository) java.lang.reflect.Proxy.newProxyInstance(
                    UserRepository.class.getClassLoader(),
                    new Class<?>[]{UserRepository.class},
                    (proxy, method, args) -> switch (method.getName()) {
                        case "findById" -> stub.findById((String) args[0]);
                        case "save" -> stub.save((User) args[0]);
                        default -> throw new UnsupportedOperationException(
                                "BlockService shouldn't be calling " + method.getName());
                    });
        }
    }
}
