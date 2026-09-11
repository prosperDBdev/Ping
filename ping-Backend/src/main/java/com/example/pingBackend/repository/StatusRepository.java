package com.example.pingBackend.repository;

import com.example.pingBackend.model.Status;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface StatusRepository extends MongoRepository<Status, String> {

    /**
     * The feed query: live statuses from an already-vetted set of authors.
     *
     * Note what this method does and does not do. Expiry is enforced here, in
     * the query — an expired status is never loaded in the first place, so no
     * caller can forget to filter it out. Everything else about visibility
     * (blocking, hidden-from lists) is decided BEFORE this call, by narrowing
     * the author set. That split is deliberate: it means there is exactly one
     * place in the codebase that decides who may see whom, instead of the same
     * rule being reimplemented in each query that touches statuses.
     */
    List<Status> findByAuthorIdInAndExpiresAtAfterOrderByCreatedAtAsc(
            List<String> authorIds, LocalDateTime now);

    /** A single user's own live statuses — used for "my status" and view counts. */
    List<Status> findByAuthorIdAndExpiresAtAfterOrderByCreatedAtAsc(
            String authorId, LocalDateTime now);

    /** Serving media: resolve a key back to the status that owns it, to authorise the request. */
    Optional<Status> findByMediaKey(String mediaKey);

    /**
     * Does any OTHER status still point at this object key?
     *
     * Resharing deliberately reuses the original's R2 object instead of
     * copying it — a copy would double the storage cost of every reshare for
     * no benefit, since the bytes are identical and already sanitized. The
     * consequence is that an object can outlive the status that introduced it,
     * so the cleanup job has to ask this before deleting a blob. Without it,
     * the original expiring at 24 hours would silently break every reshare of
     * it that was still live.
     */
    boolean existsByMediaKeyAndIdNot(String mediaKey, String id);

    /** Cleanup candidates: expired for longer than the grace period. */
    List<Status> findByExpiresAtBefore(LocalDateTime cutoff);

    /** Free-tier guard: how much has this user posted in the current window? */
    long countByAuthorIdAndCreatedAtAfter(String authorId, LocalDateTime since);
}
