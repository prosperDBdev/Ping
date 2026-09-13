package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * A 24-hour status post.
 *
 * TWO INDEPENDENT MECHANISMS MAKE A STATUS DISAPPEAR, and they do different jobs:
 *
 *   1. `expiresAt` is what the API reads. Every feed query filters on it, so a
 *      status becomes invisible the moment it passes, whether or not any
 *      cleanup has run. Visibility must never depend on a background job
 *      having fired — if the job is broken, expired content staying readable
 *      would be a privacy failure, not just a tidiness one.
 *
 *   2. Deletion is a separate concern, handled by ExpiredStatusCleanupJob,
 *      because the Mongo document is only half of a status. The other half is
 *      an object in R2, and no database mechanism knows that object exists.
 *
 * That second point is why this class carries a TTL index set to SEVEN DAYS
 * rather than 24 hours (see StatusIndexConfig). Mongo's TTL monitor deletes
 * documents without running any of your code, so if it fired at 24h it would
 * erase the only record of which R2 key belonged to this status — orphaning
 * the blob permanently, invisible and unfindable, quietly consuming the free
 * tier. The cleanup job is meant to get there first and delete both halves;
 * the TTL index sits behind it purely as a backstop so the collection cannot
 * grow without bound if that job ever stops running.
 *
 * This is the mirror image of the reasoning in ExpiredConversationCleanupJob.
 * There, a TTL index was the wrong tool because the conversations collection
 * holds permanent documents that must never be auto-deleted. Here, every
 * single document is meant to expire, which is exactly the condition that
 * makes a TTL index safe — and it still can't be the whole answer, because of
 * the blob.
 */
@Document(collection = "statuses")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Status {

    public enum Type {
        /** Words on a coloured background. No object storage involved. */
        TEXT,
        /** An uploaded image, sanitized through the Stage 8 pipeline. */
        IMAGE
    }

    @Id
    private String id;

    /** Who posted it. Indexed because every feed query filters on a set of these. */
    @Indexed
    private String authorId;

    private Type type;

    /** The words for a TEXT status, or the optional caption on an IMAGE one. */
    private String text;

    /** TEXT only — a colour token chosen by the client, stored as given. */
    private String backgroundColor;

    /**
     * R2 object key for an IMAGE status; null for TEXT.
     *
     * Indexed because two separate paths look a status up by its key: serving
     * the bytes (to check the requester may see it) and the cleanup job (to
     * check whether any OTHER status still needs the same object — a reshare
     * points at the original's key rather than duplicating the file).
     */
    @Indexed
    private String mediaKey;

    private String mediaMimeType;

    private long mediaSizeBytes;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Set at creation to createdAt + the configured lifetime. */
    @Indexed
    private LocalDateTime expiresAt;

    /**
     * Everyone who has opened this status.
     *
     * A list rather than a counter so the author can see who, which is the
     * whole point of the feature. It only ever grows within a 24-hour window
     * bounded by the author's contact count, so it can't run away.
     */
    @Builder.Default
    private List<String> viewerIds = new ArrayList<>();

    /**
     * Reactions, keyed by the reacting user's id.
     *
     * A map rather than a list of (user, emoji) pairs because the rule is ONE
     * reaction per person — reacting again replaces it. A map makes that rule
     * structural: there is no way to store two reactions from the same user, so
     * no code path can forget to deduplicate.
     *
     * Visible only to the author. See StatusService.react for why.
     */
    @Builder.Default
    private Map<String, String> reactions = new HashMap<>();

    /**
     * Set when this status is a reshare of someone else's.
     *
     * The original's id is kept for provenance, but the author's id and name
     * are copied rather than looked up: the original is on its own 24-hour
     * clock and may be deleted while this reshare is still live, and attribution
     * that vanishes when the source does is worse than no attribution at all.
     */
    private String resharedFromStatusId;
    private String resharedFromAuthorId;
    private String resharedFromAuthorUsername;
}
