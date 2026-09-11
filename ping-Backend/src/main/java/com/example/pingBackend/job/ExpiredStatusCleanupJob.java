package com.example.pingBackend.job;

import com.example.pingBackend.model.Status;
import com.example.pingBackend.repository.StatusRepository;
import com.example.pingBackend.service.StatusService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Deletes statuses that have been expired for longer than the grace period,
 * along with the R2 objects belonging to them.
 *
 * WHY THIS EXISTS ALONGSIDE A TTL INDEX, which is the interesting part:
 *
 * The statuses collection does have a TTL index — unlike conversations, every
 * document in it is genuinely meant to expire, which is the condition that
 * makes TTL safe. But a TTL index can only delete the Mongo document, and a
 * status is two things: a document and, usually, an image in object storage.
 * The document is the only record that the image exists. Let the database
 * delete it and the image becomes unreachable garbage that still costs money.
 *
 * So the division of labour is:
 *   - this job runs first (grace period measured in hours) and deletes BOTH
 *     halves, in the order that makes a crash recoverable;
 *   - the TTL index sits at seven days as a backstop, keeping the collection
 *     bounded if this job ever stops running — accepting orphaned blobs as the
 *     price of not letting the database grow forever.
 *
 * If you ever see the TTL index doing the deleting, that's a bug report about
 * this job, not a success.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ExpiredStatusCleanupJob {

    private final StatusRepository statusRepository;
    private final StatusService statusService;

    @Value("${status.cleanup.dry-run:true}")
    private boolean dryRun;

    @Value("${status.cleanup.grace-period-hours:2}")
    private long gracePeriodHours;

    @PostConstruct
    void logConfiguration() {
        log.info("Expired status cleanup ready — dryRun={}, gracePeriodHours={}",
                dryRun, gracePeriodHours);
    }

    @Scheduled(fixedRateString = "${status.cleanup.interval-ms:1800000}")
    public void deleteExpiredStatuses() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(gracePeriodHours);

        List<Status> expired = statusRepository.findByExpiresAtBefore(cutoff);
        if (expired.isEmpty()) {
            return;
        }

        long withMedia = expired.stream().filter(s -> s.getMediaKey() != null).count();
        log.info("Expired status cleanup: {} candidate(s) expired before {} ({} with stored images)",
                expired.size(), cutoff, withMedia);

        if (dryRun) {
            log.info("status.cleanup.dry-run=true — nothing was deleted. "
                    + "Set it to false once these candidates look correct.");
            return;
        }

        int deleted = 0;
        for (Status status : expired) {
            // Redundant with the query, and kept anyway — the same last line of
            // defense the conversation job has. An irreversible operation
            // should never rely on a single check being correct.
            if (status.getExpiresAt() == null || !status.getExpiresAt().isBefore(cutoff)) {
                log.warn("Skipping status id={} — failed the pre-delete safety check "
                        + "(expiresAt={}, cutoff={})", status.getId(), status.getExpiresAt(), cutoff);
                continue;
            }

            // Delegated rather than reimplemented. deleteWithBlob is what the
            // user-facing delete endpoint calls too, and it holds the reference
            // check that stops an expiring original from breaking a reshare
            // that is still live. Duplicating the deletion here would be a
            // second place for that check to be forgotten.
            statusService.deleteWithBlob(status);
            deleted++;
        }

        log.info("Expired status cleanup finished: {} of {} candidate(s) deleted",
                deleted, expired.size());
    }
}
