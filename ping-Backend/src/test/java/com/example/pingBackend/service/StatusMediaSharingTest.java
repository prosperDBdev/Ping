package com.example.pingBackend.service;

import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.Status;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.StatusRepository;
import com.example.pingBackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Regression test for status images shared between an original and its reshares.
 *
 * THE BUG THIS PINS DOWN: resharing reuses the original's R2 object instead of
 * copying it, so after one image reshare, two status documents carry the same
 * media key. The media endpoint looked the key up with a single-result query,
 * Spring Data threw when it matched two documents, and the image stopped
 * loading for everyone — the author of the original included.
 *
 * Nothing about that failure was visible in a test that only reshared text,
 * which is exactly what the earlier suite did. So every scenario here involves
 * a key that more than one status points at.
 *
 * The cast, and who knows whom:
 *
 *     author ── resharer ── resharersFriend        stranger (knows nobody)
 *
 *   author posts an image; resharer reshares it. resharersFriend is a contact
 *   of the resharer but NOT of the author, so the only route by which they can
 *   see the image is the reshare.
 */
class StatusMediaSharingTest {

    private static final String KEY = "statuses/author/shared-image";
    private static final byte[] BYTES = {1, 2, 3, 4};

    private final Map<String, User> users = new HashMap<>();
    private final Map<String, Status> statuses = new HashMap<>();
    private final List<Conversation> conversations = new ArrayList<>();

    private User author, resharer, resharersFriend, stranger;
    private Status original, reshare;
    private StatusService service;

    @BeforeEach
    void setUp() {
        author = user("author");
        resharer = user("resharer");
        resharersFriend = user("resharersFriend");
        stranger = user("stranger");

        // Contacts are derived from shared conversations.
        conversations.add(conversation(author, resharer));
        conversations.add(conversation(resharer, resharersFriend));

        LocalDateTime later = LocalDateTime.now().plusHours(12);

        original = status("original", author, later, null);
        reshare = status("reshare", resharer, later, original.getId());

        UserRepository userRepo = proxy(UserRepository.class, (name, args) -> switch (name) {
            case "findById" -> Optional.ofNullable(users.get((String) args[0]));
            case "findAllById" -> {
                List<User> found = new ArrayList<>();
                ((Iterable<?>) args[0]).forEach(id -> {
                    if (users.containsKey((String) id)) found.add(users.get((String) id));
                });
                yield found;
            }
            default -> unsupported(name);
        });

        StatusRepository statusRepo = proxy(StatusRepository.class, (name, args) -> switch (name) {
            case "findAllByMediaKey" -> statuses.values().stream()
                    .filter(s -> args[0].equals(s.getMediaKey()))
                    .toList();
            case "findById" -> Optional.ofNullable(statuses.get((String) args[0]));
            default -> unsupported(name);
        });

        ConversationRepository conversationRepo = proxy(ConversationRepository.class, (name, args) -> switch (name) {
            case "findByParticipantsContainingOrderByUpdatedAtDesc" -> conversations.stream()
                    .filter(c -> c.getParticipants().contains((String) args[0]))
                    .toList();
            default -> unsupported(name);
        });

        // A storage double that never touches R2. Its constructor only assigns
        // fields, so passing nulls is safe; the one method under test is
        // overridden to hand back known bytes.
        MediaStorageService storage = new MediaStorageService(null, null, null) {
            @Override
            public DownloadedMedia getObjectBytes(String key) {
                return new DownloadedMedia(BYTES, "image/jpeg");
            }
        };

        BlockService blockService = new BlockService(userRepo);

        service = new StatusService(
                statusRepo, userRepo, conversationRepo, blockService, storage,
                null, null, null);
    }

    @Test
    @DisplayName("the author can still load their own image after it has been reshared")
    void authorLoadsOwnImageAfterReshare() {
        // This is the exact case that was throwing.
        assertArrayEquals(BYTES, service.downloadStatusMedia(KEY, author).bytes());
    }

    @Test
    @DisplayName("the resharer can load the image")
    void resharerLoadsImage() {
        assertArrayEquals(BYTES, service.downloadStatusMedia(KEY, resharer).bytes());
    }

    @Test
    @DisplayName("a contact of the resharer — but not of the author — can load it through the reshare")
    void reachesResharersAudience() {
        assertArrayEquals(BYTES, service.downloadStatusMedia(KEY, resharersFriend).bytes());
    }

    @Test
    @DisplayName("a stranger still can't, even though several statuses share the key")
    void strangerRefused() {
        assertThrows(ForbiddenMediaAccessException.class,
                () -> service.downloadStatusMedia(KEY, stranger));
    }

    @Test
    @DisplayName("a key no status uses is refused with the same exception as a forbidden one")
    void unknownKeyLooksForbidden() {
        assertThrows(ForbiddenMediaAccessException.class,
                () -> service.downloadStatusMedia("statuses/nobody/nothing", author));
    }

    @Test
    @DisplayName("once the reshare expires, the resharer's audience loses the image")
    void expiredReshareCutsOffItsAudience() {
        reshare.setExpiresAt(LocalDateTime.now().minusMinutes(1));

        assertThrows(ForbiddenMediaAccessException.class,
                () -> service.downloadStatusMedia(KEY, resharersFriend));
        // ...while the author, reaching it through their own live original, is unaffected.
        assertArrayEquals(BYTES, service.downloadStatusMedia(KEY, author).bytes());
    }

    // --------------------------------------------------------------------

    private User user(String id) {
        User u = User.builder()
                .id(id).username(id)
                .blockedUsers(new ArrayList<>())
                .hiddenStatusFrom(new ArrayList<>())
                .build();
        users.put(id, u);
        return u;
    }

    private Conversation conversation(User a, User b) {
        return Conversation.builder()
                .type("PRIVATE")
                .participants(new ArrayList<>(List.of(a.getId(), b.getId())))
                .build();
    }

    private Status status(String id, User author, LocalDateTime expiresAt, String resharedFrom) {
        Status s = Status.builder()
                .id(id)
                .authorId(author.getId())
                .type(Status.Type.IMAGE)
                .mediaKey(KEY)
                .mediaMimeType("image/jpeg")
                .createdAt(LocalDateTime.now())
                .expiresAt(expiresAt)
                .resharedFromStatusId(resharedFrom)
                .build();
        statuses.put(id, s);
        return s;
    }

    @FunctionalInterface
    private interface Handler {
        Object handle(String methodName, Object[] args);
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, Handler handler) {
        return (T) Proxy.newProxyInstance(
                type.getClassLoader(),
                new Class<?>[]{type},
                (p, method, args) -> handler.handle(method.getName(), args));
    }

    private static Object unsupported(String name) {
        throw new UnsupportedOperationException("This test doesn't expect a call to " + name);
    }
}
