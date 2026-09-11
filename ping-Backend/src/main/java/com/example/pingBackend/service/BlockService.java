package com.example.pingBackend.service;

import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class BlockService {

    private final UserRepository userRepository;

    public void block(String blockerId, String blockedId) {
        if (blockerId.equals(blockedId)) {
            throw new RuntimeException("You can't block yourself");
        }

        User blocker = userRepository.findById(blockerId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        userRepository.findById(blockedId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Same null case as blocks(): a user document written before this
        // field existed has no list to add to.
        if (blocker.getBlockedUsers() == null) {
            blocker.setBlockedUsers(new java.util.ArrayList<>());
        }
        if (!blocker.getBlockedUsers().contains(blockedId)) {
            blocker.getBlockedUsers().add(blockedId);
            userRepository.save(blocker);
        }
    }

    public void unblock(String blockerId, String blockedId) {
        User blocker = userRepository.findById(blockerId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (blocker.getBlockedUsers() != null && blocker.getBlockedUsers().remove(blockedId)) {
            userRepository.save(blocker);
        }
    }

    /**
     * True if EITHER user has blocked the other.
     *
     * Every enforcement point in the app funnels through here, so whatever
     * this decides is what "blocked" means across the whole product. Two
     * properties matter more than the mechanics, and both are noted inline:
     * the check is symmetric, and it fails closed.
     */
    public boolean isBlockedBetween(String userIdA, String userIdB) {
        // Fail closed. A missing id is a broken caller, and the safe answer to
        // "may these two interact?" when you don't know is no.
        if (userIdA == null || userIdB == null) {
            return true;
        }

        // You are never blocked from yourself — without this, anything that
        // happens to compare a user against themselves (a self-conversation,
        // a search result edge case) would be refused for no reason.
        if (userIdA.equals(userIdB)) {
            return false;
        }

        Optional<User> a = userRepository.findById(userIdA);
        Optional<User> b = userRepository.findById(userIdB);

        // Also fail closed: an id that resolves to nobody is not permission to
        // proceed. Deleted account, bad id, stale reference — all of them mean
        // "don't deliver this", not "go ahead".
        if (a.isEmpty() || b.isEmpty()) {
            return true;
        }

        // Symmetric on purpose. Checking only "is the recipient blocking the
        // sender" would leave the blocker free to keep messaging the person
        // they blocked, which is precisely what blocking exists to stop.
        return blocks(a.get(), userIdB) || blocks(b.get(), userIdA);
    }

    /**
     * Null-safe membership test.
     *
     * @Builder.Default only applies when the builder constructs the object —
     * it does nothing when Mongo deserialises a document written before this
     * field existed. Every user created prior to blocking shipping has no
     * blockedUsers key at all, so this list really can be null in practice.
     */
    private boolean blocks(User user, String otherUserId) {
        List<String> blocked = user.getBlockedUsers();
        return blocked != null && blocked.contains(otherUserId);
    }

    /** Convenience wrapper so call sites read as a guard rather than an if. */
    public void assertNotBlocked(String userIdA, String userIdB) {
        if (isBlockedBetween(userIdA, userIdB)) {
            throw new BlockedUserException("You can't do that — one of you has blocked the other.");
        }
    }
}
