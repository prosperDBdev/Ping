package com.example.pingBackend.job;

import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.Message;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.MessageRepository;
import com.example.pingBackend.service.MediaStorageService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Permanently deletes temporary conversations (and their messages) once
 * they've been expired for longer than the grace period.
 *
 * WHY THIS IS A SCHEDULED JOB AND NOT A MONGODB TTL INDEX:
 *
 * A TTL index is a database-level mechanism that silently deletes documents
 * with no application code involved — nothing to read, nothing to log,
 * nothing to test, and no way to see what it did after the fact. That's a
 * poor fit for the only destructive operation in this codebase. A plain
 * @Scheduled method is deliberately boring by comparison: every deletion
 * runs through code you can read, log, unit-test, and dry-run, and the
 * query can be scoped so tightly that it is structurally incapable of
 * matching a permanent conversation.
 *
 * SAFETY RAILS, given how much damage a wrong query here would do:
 *   - `dryRun` defaults to TRUE. Out of the box this job only ever LOGS what
 *     it would delete. Flip temporary-chat.cleanup.dry-run=false in
 *     application.properties once you've watched the logs and are satisfied
 *     it's selecting exactly what you expect, and nothing else.
 *   - A grace period means a conversation isn't deleted the instant it
 *     expires — there's a window where it's already invisible via the API
 *     but still recoverable if something's wrong.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ExpiredConversationCleanupJob {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final MediaStorageService mediaStorageService;

    @Value("${temporary-chat.cleanup.dry-run:true}")
    private boolean dryRun;

    @Value("${temporary-chat.cleanup.grace-period-hours:24}")
    private long gracePeriodHours;

    /**
     * Announce the configuration this job booted with.
     *
     * Worth keeping permanently: this is the one component that deletes user
     * data, and "is it armed, and with what settings?" shouldn't require
     * reading the properties file and inferring. If dry-run is ever off in an
     * environment where you expected it on, this line is where you'd notice.
     */
    @PostConstruct
    void logConfiguration() {
        log.info("Expired temporary conversation cleanup ready — dryRun={}, gracePeriodHours={}",
                dryRun, gracePeriodHours);
    }

    /**
     * Runs hourly. Deletes temporary conversations that expired more than
     * `gracePeriodHours` ago, along with their messages.
     *
     * WHAT YOU NEED TO IMPLEMENT — read all of this before writing anything,
     * because the ordering matters:
     *
     *   1. Compute the cutoff:
     *          LocalDateTime cutoff = LocalDateTime.now().minusHours(gracePeriodHours);
     *      Anything that expired BEFORE this cutoff is eligible. (Not
     *      "before now" — that would delete conversations the instant they
     *      expire, with no grace period at all.)
     *
     *   2. Find candidates with the repository method built for exactly this:
     *          conversationRepository.findByTemporaryTrueAndExpiresAtBefore(cutoff)
     *      Note it filters on temporary=true inside the query itself, so a
     *      permanent conversation can never appear in this list regardless of
     *      what cutoff you pass.
     *
     *   3. If the list is empty, return early — don't log noise every hour.
     *
     *   4. Log what you found BEFORE deleting anything: the count, and each
     *      conversation's id + expiresAt. This log line is what makes the
     *      job auditable, and in dry-run mode it's the entire output.
     *
     *   5. If `dryRun` is true, log that nothing was deleted and RETURN here.
     *      Everything past this point must not run in dry-run mode.
     *
     *   6. For each conversation:
     *        a. Defensive re-check before deleting — even though step 2's
     *           query already guarantees it, assert `conversation.isTemporary()`
     *           and that `getExpiresAt()` is non-null and before the cutoff.
     *           If a conversation somehow fails this, log a warning and SKIP
     *           it rather than deleting. Redundant by design: this is the
     *           last line of defense on an irreversible operation, and the
     *           cost of the check is nothing next to the cost of being wrong.
     *        b. Delete its messages:
     *               messageRepository.deleteAll(
     *                   messageRepository.findByConversationId(conversation.getId()));
     *           (You'll need to add `List<Message> findByConversationId(String
     *           conversationId);` to MessageRepository — it doesn't exist yet.)
     *        c. Delete the conversation itself:
     *               conversationRepository.delete(conversation);
     *        d. Log the id you just deleted.
     *
     *   7. Log a final summary count.
     *
     * Deliberately NOT deleting: the TemporaryConversationInvite records.
     * Those are a small audit trail of what was proposed and agreed to, and
     * they don't hold message content.
     */
    @Scheduled(fixedRateString = "${temporary-chat.cleanup.interval-ms:3600000}")
    public void deleteExpiredTemporaryConversations() {
        // A conversation is only eligible once it has been expired for the
        // whole grace period — not the moment expiresAt passes.
        LocalDateTime cutoff = LocalDateTime.now().minusHours(gracePeriodHours);

        List<Conversation> expired =
                conversationRepository.findByTemporaryTrueAndExpiresAtBefore(cutoff);

        // Deliberately no repository.count() here for extra context: log arguments
        // are evaluated eagerly regardless of log level, so that would fire an extra
        // query on every pass even in production with DEBUG off.
        log.debug("Cleanup pass ran: cutoff={} candidates={}", cutoff, expired.size());

        if (expired.isEmpty()) {
            return;
        }

        // Audit log first, before anything is touched. In dry-run mode this is
        // the entire output of the job.
        log.info("Expired temporary conversation cleanup: {} candidate(s) expired before {}",
                expired.size(), cutoff);
        for (Conversation conversation : expired) {
            // Counted here rather than just in the delete branch so a dry run
            // reports the true blast radius — including stored files, which
            // are the part that costs money if this is ever wrong.
            List<Message> messages = messageRepository.findByConversationId(conversation.getId());
            long attachmentCount = messages.stream()
                    .filter(m -> m.getAttachment() != null && m.getAttachment().getKey() != null)
                    .count();

            log.info("  candidate conversation id={} expiresAt={} messages={} storedFiles={}",
                    conversation.getId(), conversation.getExpiresAt(), messages.size(), attachmentCount);
        }

        if (dryRun) {
            log.info("temporary-chat.cleanup.dry-run=true — nothing was deleted. "
                    + "Set it to false once these candidates look correct.");
            return;
        }

        int deleted = 0;
        for (Conversation conversation : expired) {
            // Redundant with the repository query by design: this is the last
            // line of defense on an irreversible operation, so anything that
            // doesn't independently prove itself eligible gets skipped.
            if (!conversation.isTemporary()
                    || conversation.getExpiresAt() == null
                    || !conversation.getExpiresAt().isBefore(cutoff)) {
                log.warn("Skipping conversation id={} — failed the pre-delete safety check "
                                + "(temporary={}, expiresAt={}, cutoff={})",
                        conversation.getId(), conversation.isTemporary(),
                        conversation.getExpiresAt(), cutoff);
                continue;
            }

            List<Message> messages = messageRepository.findByConversationId(conversation.getId());

            // Stored files go BEFORE the message rows, and that order is the
            // whole point: the message document is the only record of which
            // object key belongs to this conversation. Delete the rows first
            // and crash before reaching R2, and those blobs are orphaned with
            // nothing left pointing at them — invisible, unfindable, and
            // silently consuming storage forever. Doing it this way, a crash
            // leaves the rows intact so the next run simply retries (R2's
            // delete is idempotent, so re-deleting a gone key is harmless).
            int blobsDeleted = 0;
            for (Message message : messages) {
                Message.Attachment attachment = message.getAttachment();
                if (attachment == null || attachment.getKey() == null) continue;

                try {
                    mediaStorageService.deleteObject(attachment.getKey());
                    blobsDeleted++;
                } catch (RuntimeException e) {
                    // A storage hiccup on one file must not strand the actual
                    // data deletion — removing the messages is the obligation,
                    // reclaiming bytes is the optimization. Logged loudly so a
                    // persistent leak is visible, and the bucket's lifecycle
                    // rule is the long-stop for anything that keeps failing.
                    log.error("Failed to delete stored file key={} for conversation id={} — "
                                    + "the message rows will still be removed, so this blob is "
                                    + "now orphaned and relies on the bucket lifecycle rule",
                            attachment.getKey(), conversation.getId(), e);
                }
            }

            messageRepository.deleteAll(messages);
            conversationRepository.delete(conversation);
            deleted++;

            log.info("Deleted expired temporary conversation id={} ({} message(s), {} stored file(s))",
                    conversation.getId(), messages.size(), blobsDeleted);
        }

        log.info("Expired temporary conversation cleanup finished: {} of {} candidate(s) deleted",
                deleted, expired.size());
    }
}
