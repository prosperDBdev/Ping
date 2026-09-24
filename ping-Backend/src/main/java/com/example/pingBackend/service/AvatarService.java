package com.example.pingBackend.service;

import com.example.pingBackend.exception.NotFoundException;
import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Setting, clearing and serving a user's profile photo.
 *
 * WHERE THE BYTES LIVE. In R2, under an "avatars/" key prefix, through the same
 * MediaStorageService pipeline that handles chat images and statuses — size cap,
 * real type sniffed from the bytes, decompression-bomb guard, decode and
 * re-encode. Not in the User document: Mongo documents have a 16MB ceiling and
 * are loaded in full on every single authenticated request, so a photo stored
 * inline would be read from the database and deserialised every time its owner
 * sent a message.
 *
 * WHAT THE USER DOCUMENT HOLDS INSTEAD is two strings:
 *
 *   avatarKey — the R2 object key. Internal; never leaves the server, and is
 *               absent from UserResponse. It exists so a replaced photo's old
 *               object can be deleted rather than orphaned in the bucket.
 *
 *   avatarUrl — the address a client fetches, "/api/users/{id}/avatar?v=...".
 *               The bucket is private, so this points at our own endpoint, not
 *               at R2. Null means no photo, which is how the UI knows to draw
 *               initials instead.
 *
 * WHY THE ?v= . Without it the address for a given user never changes, so after
 * changing their photo a user would keep seeing the old one out of the browser
 * cache until it expired. The version is taken from the new object's key, so it
 * changes on every upload and the old cache entry is simply never asked for
 * again. The endpoint ignores the parameter; its only job is to be different.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AvatarService {

    private final UserRepository userRepository;
    private final MediaStorageService mediaStorageService;

    /**
     * Replace this user's photo and return the new URL.
     *
     * @param currentUser the AUTHENTICATED user. There is no userId parameter
     *                    on purpose: with no way to name a target, "change
     *                    someone else's photo" isn't a request this method can
     *                    be asked to make.
     */
    public String upload(User currentUser, MultipartFile file) {
        StoredMedia stored = mediaStorageService.uploadAvatar(file, currentUser.getId());

        String previousKey = currentUser.getAvatarKey();

        currentUser.setAvatarKey(stored.key());
        currentUser.setAvatarUrl(urlFor(currentUser.getId(), stored.key()));
        userRepository.save(currentUser);

        // ORDER MATTERS. The document is pointed at the new object BEFORE the
        // old one is removed. Deleting first would open a window — however
        // short — in which the saved key refers to an object that no longer
        // exists, and a crash inside that window would make it permanent.
        // Doing it this way, the worst case is a leftover object nobody
        // references, which costs a little storage and breaks nothing.
        deleteQuietly(previousKey);

        return currentUser.getAvatarUrl();
    }

    /** Remove this user's photo. Safe to call when they don't have one. */
    public void remove(User currentUser) {
        String previousKey = currentUser.getAvatarKey();

        currentUser.setAvatarKey(null);
        currentUser.setAvatarUrl(null);
        userRepository.save(currentUser);

        deleteQuietly(previousKey);
    }

    /**
     * Fetch a user's photo bytes.
     *
     * AUTHORISATION. This calls MediaStorageService.getObjectBytes, which
     * performs no permission check of its own and is documented as being for
     * callers that have already authorised the request. The rule being applied
     * here is "any signed-in user may see any user's profile photo", enforced by
     * SecurityConfig's deny-by-default: reaching the endpoint at all requires a
     * valid token. That is the intended rule — an avatar is shown next to its
     * owner in search results and group lists, to people who may not have
     * exchanged a message with them yet.
     *
     * It also means the key is never taken from the caller. A client asks for a
     * USER's photo; the key is looked up from that user's document. An endpoint
     * that accepted a key would let anyone who guessed one read any object in
     * the bucket.
     */
    public DownloadedMedia load(String userId) {
        User owner = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("No profile photo"));

        String key = owner.getAvatarKey();
        if (key == null || key.isBlank()) {
            // Same message and status whether the user has no photo or doesn't
            // exist, so this endpoint can't be used to test which ids are real.
            throw new NotFoundException("No profile photo");
        }

        return mediaStorageService.getObjectBytes(key);
    }

    /**
     * Best-effort cleanup of a replaced object.
     *
     * Swallows failures on purpose. By the time this runs the user's document
     * is already saved and the request has logically succeeded; turning a
     * storage hiccup into a failed response would tell someone their photo
     * didn't change when it did.
     */
    private void deleteQuietly(String key) {
        if (key == null || key.isBlank()) {
            return;
        }
        try {
            mediaStorageService.deleteObject(key);
        } catch (RuntimeException e) {
            log.warn("Could not delete replaced avatar object {}: {}", key, e.getMessage());
        }
    }

    /** Package-private so the test can check the shape without going through Mongo. */
    static String urlFor(String userId, String objectKey) {
        String lastSegment = objectKey.substring(objectKey.lastIndexOf('/') + 1);
        String version = lastSegment.length() > 8 ? lastSegment.substring(0, 8) : lastSegment;
        return "/api/users/" + userId + "/avatar?v=" + version;
    }
}
