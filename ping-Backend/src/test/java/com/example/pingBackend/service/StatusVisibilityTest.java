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
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The contract for StatusService.canSeeStatusesOf.
 *
 * THIS SUITE FAILS UNTIL YOU IMPLEMENT THAT METHOD, and that's deliberate:
 * these tests are the specification, written before the code, so you can work
 * against them rather than against a paragraph of prose. Run them with
 *
 *     ./mvnw.cmd test -Dtest=StatusVisibilityTest
 *
 * and make them green one at a time.
 *
 * Every one of these is a rule that a plausible, reasonable-looking
 * implementation gets wrong. The direction test in particular — hiding your
 * status from someone must not hide THEIRS from YOU — is a single swapped
 * variable away at all times, and it's the kind of bug that looks like a
 * feature until someone notices their friend's posts vanished.
 *
 * Note what this test does NOT provide the service: statusRepository,
 * conversationRepository and mediaStorageService are all null. If your
 * implementation touches any of them it will fail with a NullPointerException,
 * which is the point — this method decides a question about two people and a
 * contact set it was handed, and nothing else.
 */
class StatusVisibilityTest {

    private InMemoryUsers users;
    private StatusService service;

    @BeforeEach
    void setUp() {
        users = new InMemoryUsers();
        BlockService blockService = new BlockService(InMemoryUsers.asRepository(users));
        // Every dependency this method shouldn't touch is null, deliberately —
        // including the messaging ones added for replies. If canSeeStatusesOf
        // ever starts reaching for them, the test fails loudly instead of
        // quietly widening what "visibility" depends on.
        service = new StatusService(
                null, InMemoryUsers.asRepository(users), null, blockService, null,
                null, null, null);
    }

    // -----------------------------------------------------------------
    // Failing closed
    // -----------------------------------------------------------------

    @Test
    @DisplayName("a null viewer can see nothing")
    void nullViewerSeesNothing() {
        User author = user("author");
        assertFalse(service.canSeeStatusesOf(null, author, Set.of("author")));
    }

    @Test
    @DisplayName("a null author's statuses are visible to nobody")
    void nullAuthorIsInvisible() {
        User viewer = user("viewer");
        assertFalse(service.canSeeStatusesOf(viewer, null, Set.of("author")));
    }

    // -----------------------------------------------------------------
    // Yourself
    // -----------------------------------------------------------------

    @Test
    @DisplayName("you can always see your own statuses, even if you're not in your own contact set")
    void authorSeesOwn() {
        User me = user("me");
        assertTrue(service.canSeeStatusesOf(me, me, Set.of()));
    }

    @Test
    @DisplayName("hiding your status from someone never hides it from yourself")
    void authorSeesOwnDespiteHiddenList() {
        User me = user("me");
        me.setHiddenStatusFrom(new ArrayList<>(List.of("me", "someone")));
        assertTrue(service.canSeeStatusesOf(me, me, Set.of()));
    }

    // -----------------------------------------------------------------
    // Contacts only
    // -----------------------------------------------------------------

    @Test
    @DisplayName("a stranger — someone you share no conversation with — sees nothing")
    void strangerSeesNothing() {
        User viewer = user("viewer");
        User author = user("author");
        // Empty contact set: these two have never spoken.
        assertFalse(service.canSeeStatusesOf(viewer, author, Set.of()));
    }

    @Test
    @DisplayName("a contact with no blocks and no hiding can see them")
    void contactCanSee() {
        User viewer = user("viewer");
        User author = user("author");
        assertTrue(service.canSeeStatusesOf(viewer, author, Set.of("author")));
    }

    // -----------------------------------------------------------------
    // Blocking, which outranks everything
    // -----------------------------------------------------------------

    @Test
    @DisplayName("an author who blocked the viewer is invisible to them")
    void blockedByAuthor() {
        User viewer = user("viewer");
        User author = user("author");
        author.setBlockedUsers(new ArrayList<>(List.of("viewer")));
        users.save(author);
        users.save(viewer);

        assertFalse(service.canSeeStatusesOf(viewer, author, Set.of("author")));
    }

    @Test
    @DisplayName("blocking is symmetric: a viewer who blocked the author sees nothing either")
    void blockedByViewer() {
        User viewer = user("viewer");
        User author = user("author");
        viewer.setBlockedUsers(new ArrayList<>(List.of("author")));
        users.save(viewer);
        users.save(author);

        assertFalse(service.canSeeStatusesOf(viewer, author, Set.of("author")));
    }

    // -----------------------------------------------------------------
    // The hidden-from list
    // -----------------------------------------------------------------

    @Test
    @DisplayName("someone on the author's hidden-from list can't see the author's statuses")
    void hiddenFromViewer() {
        User viewer = user("viewer");
        User author = user("author");
        author.setHiddenStatusFrom(new ArrayList<>(List.of("viewer")));

        assertFalse(service.canSeeStatusesOf(viewer, author, Set.of("author")));
    }

    @Test
    @DisplayName("hiding is one-directional: hiding YOUR status from someone doesn't hide THEIRS from you")
    void hidingDoesNotWorkBackwards() {
        User viewer = user("viewer");
        User author = user("author");
        // The VIEWER has hidden their own statuses from the author. That says
        // nothing about whether the viewer may see the author's.
        viewer.setHiddenStatusFrom(new ArrayList<>(List.of("author")));

        assertTrue(service.canSeeStatusesOf(viewer, author, Set.of("author")));
    }

    @Test
    @DisplayName("a legacy user document with a null hidden-from list doesn't blow up")
    void nullHiddenListIsSafe() {
        User viewer = user("viewer");
        User author = user("author");
        // Exactly what Mongo hands back for any account created before this
        // stage: the field simply isn't in the document, and @Builder.Default
        // does nothing on deserialisation.
        author.setHiddenStatusFrom(null);
        viewer.setHiddenStatusFrom(null);

        assertTrue(service.canSeeStatusesOf(viewer, author, Set.of("author")));
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private User user(String id) {
        User u = User.builder()
                .id(id)
                .username(id)
                .blockedUsers(new ArrayList<>())
                .hiddenStatusFrom(new ArrayList<>())
                .build();
        users.save(u);
        return u;
    }

    /** Same in-memory repository trick as BlockServiceTest — a map, not a mock. */
    private static class InMemoryUsers {
        final Map<String, User> byId = new HashMap<>();

        User save(User user) {
            byId.put(user.getId(), user);
            return user;
        }

        Optional<User> findById(String id) {
            return Optional.ofNullable(byId.get(id));
        }

        static UserRepository asRepository(InMemoryUsers stub) {
            return (UserRepository) java.lang.reflect.Proxy.newProxyInstance(
                    UserRepository.class.getClassLoader(),
                    new Class<?>[]{UserRepository.class},
                    (proxy, method, args) -> switch (method.getName()) {
                        case "findById" -> stub.findById((String) args[0]);
                        case "save" -> stub.save((User) args[0]);
                        default -> throw new UnsupportedOperationException(
                                "canSeeStatusesOf shouldn't be calling " + method.getName());
                    });
        }
    }
}
