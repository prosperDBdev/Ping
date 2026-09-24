package com.example.pingBackend.service;

import com.example.pingBackend.exception.InvalidMediaException;
import com.example.pingBackend.exception.NotFoundException;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Profile photos: setting, replacing, removing and serving them.
 *
 * The storage double stands in for R2. It records which keys were deleted and
 * what the user document looked like AT THE MOMENT of each delete, because one
 * of the things worth pinning down here isn't a value but an order: the new key
 * must be saved before the old object is destroyed.
 *
 * Validation itself (size, sniffed type, pixel limits, re-encoding) belongs to
 * MediaStorageService and is stubbed out here — what this test covers is that
 * AvatarService asks for it and does the right thing when it fails.
 */
class AvatarServiceTest {

    private static final byte[] BYTES = {1, 2, 3, 4};

    private final Map<String, User> users = new HashMap<>();
    private final List<String> deletedKeys = new ArrayList<>();
    private final List<String> keyOnUserAtDeleteTime = new ArrayList<>();

    private String nextKey;
    private boolean uploadRejects;
    private boolean deleteFails;
    private int saveCount;

    private User maya;
    private AvatarService service;

    @BeforeEach
    void setUp() {
        users.clear();
        deletedKeys.clear();
        keyOnUserAtDeleteTime.clear();
        nextKey = "avatars/maya-id/first-object";
        uploadRejects = false;
        deleteFails = false;
        saveCount = 0;

        maya = User.builder().id("maya-id").username("maya").email("maya@x.com").build();
        users.put(maya.getId(), maya);

        service = new AvatarService(userRepository(), storage());
    }

    private UserRepository userRepository() {
        return proxy(UserRepository.class, (name, args) -> switch (name) {
            case "findById" -> Optional.ofNullable(users.get((String) args[0]));
            case "save" -> {
                User user = (User) args[0];
                users.put(user.getId(), user);
                saveCount++;
                yield user;
            }
            default -> throw new UnsupportedOperationException("unexpected call to " + name);
        });
    }

    private MediaStorageService storage() {
        return new MediaStorageService(null, null, null) {
            @Override
            public StoredMedia uploadAvatar(MultipartFile file, String uploaderId) {
                if (uploadRejects) {
                    throw new InvalidMediaException("Unsupported image type: text/plain");
                }
                return new StoredMedia(nextKey, "image/jpeg", BYTES.length);
            }

            @Override
            public DownloadedMedia getObjectBytes(String key) {
                return new DownloadedMedia(BYTES, "image/jpeg");
            }

            @Override
            public void deleteObject(String key) {
                // Captured before anything else so the ordering assertion below
                // sees the document exactly as it stood when the delete ran.
                keyOnUserAtDeleteTime.add(users.get(maya.getId()).getAvatarKey());
                if (deleteFails) {
                    throw new IllegalStateException("R2 is unreachable");
                }
                deletedKeys.add(key);
            }
        };
    }

    private static MultipartFile photo() {
        return new MockMultipartFile("file", "selfie.jpg", "image/jpeg", BYTES);
    }

    // ------------------------------------------------------------------ upload

    @Test
    @DisplayName("uploading stores the object key and a URL pointing at our own endpoint")
    void uploadStoresKeyAndUrl() {
        String url = service.upload(maya, photo());

        assertEquals("avatars/maya-id/first-object", maya.getAvatarKey());
        assertEquals(url, maya.getAvatarUrl());
        assertTrue(url.startsWith("/api/users/maya-id/avatar"), url);
        // Never an R2 address: the bucket is private and the browser goes
        // through us.
        assertTrue(url.contains("?v="), url);
    }

    @Test
    @DisplayName("the URL changes when the photo changes, so a cached picture is never reused")
    void urlChangesWithThePhoto() {
        String first = service.upload(maya, photo());

        nextKey = "avatars/maya-id/second-object";
        String second = service.upload(maya, photo());

        assertTrue(!first.equals(second), "both uploads produced " + first);
    }

    @Test
    @DisplayName("replacing a photo deletes the object the old one used")
    void replacingDeletesTheOldObject() {
        service.upload(maya, photo());

        nextKey = "avatars/maya-id/second-object";
        service.upload(maya, photo());

        assertEquals(List.of("avatars/maya-id/first-object"), deletedKeys);
        assertEquals("avatars/maya-id/second-object", maya.getAvatarKey());
    }

    @Test
    @DisplayName("the new key is saved BEFORE the old object is deleted")
    void savesBeforeDeleting() {
        service.upload(maya, photo());
        nextKey = "avatars/maya-id/second-object";
        service.upload(maya, photo());

        // If this were the other way round, a crash between the two steps would
        // leave the document pointing at an object that no longer exists — a
        // permanently broken avatar. Pointing at the new one first means the
        // worst case is an unreferenced leftover object.
        assertEquals(List.of("avatars/maya-id/second-object"), keyOnUserAtDeleteTime);
    }

    @Test
    @DisplayName("a first upload has nothing to delete")
    void firstUploadDeletesNothing() {
        service.upload(maya, photo());
        assertTrue(deletedKeys.isEmpty());
    }

    @Test
    @DisplayName("a rejected image leaves the profile untouched")
    void rejectedImageChangesNothing() {
        service.upload(maya, photo());
        String originalKey = maya.getAvatarKey();
        int savesBefore = saveCount;

        uploadRejects = true;
        assertThrows(InvalidMediaException.class, () -> service.upload(maya, photo()));

        assertEquals(originalKey, maya.getAvatarKey());
        assertEquals(savesBefore, saveCount, "nothing should have been written");
        assertTrue(deletedKeys.isEmpty(), "the existing photo should not have been deleted");
    }

    @Test
    @DisplayName("storage failing to delete the old object doesn't fail the upload")
    void deleteFailureDoesNotFailTheRequest() {
        service.upload(maya, photo());

        nextKey = "avatars/maya-id/second-object";
        deleteFails = true;

        assertDoesNotThrow(() -> service.upload(maya, photo()));
        // The photo really did change — the only casualty is an orphaned object.
        assertEquals("avatars/maya-id/second-object", maya.getAvatarKey());
    }

    // ------------------------------------------------------------------ remove

    @Test
    @DisplayName("removing clears both fields and deletes the object")
    void removeClearsEverything() {
        service.upload(maya, photo());

        service.remove(maya);

        assertNull(maya.getAvatarKey());
        assertNull(maya.getAvatarUrl());
        assertEquals(List.of("avatars/maya-id/first-object"), deletedKeys);
    }

    @Test
    @DisplayName("removing a photo you don't have succeeds quietly")
    void removeWithoutAPhotoIsFine() {
        assertDoesNotThrow(() -> service.remove(maya));
        assertNull(maya.getAvatarUrl());
        assertTrue(deletedKeys.isEmpty());
    }

    // ------------------------------------------------------------------- serve

    @Test
    @DisplayName("anyone signed in can load a user's photo by that user's id")
    void loadReturnsTheBytes() {
        service.upload(maya, photo());

        DownloadedMedia media = service.load("maya-id");

        assertArrayEquals(BYTES, media.bytes());
        assertEquals("image/jpeg", media.contentType());
    }

    @Test
    @DisplayName("a user with no photo and a user who doesn't exist fail identically")
    void missingPhotoAndMissingUserLookTheSame() {
        // Same status and same wording, so this endpoint can't be used to work
        // out which user ids are real.
        NotFoundException noPhoto = assertThrows(NotFoundException.class, () -> service.load("maya-id"));
        NotFoundException noUser = assertThrows(NotFoundException.class, () -> service.load("nobody"));

        assertEquals(noPhoto.getMessage(), noUser.getMessage());
        assertEquals(noPhoto.getStatus(), noUser.getStatus());
    }

    @Test
    @DisplayName("a removed photo stops being servable")
    void removedPhotoIsGone() {
        service.upload(maya, photo());
        service.remove(maya);

        assertThrows(NotFoundException.class, () -> service.load("maya-id"));
    }

    // --------------------------------------------------------------------- url

    @Test
    @DisplayName("the URL is built from the user's id, never from anything a client sent")
    void urlShape() {
        assertEquals("/api/users/abc/avatar?v=12345678",
                AvatarService.urlFor("abc", "avatars/abc/123456789abcdef"));
    }

    // --------------------------------------------------------------------------

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
}
