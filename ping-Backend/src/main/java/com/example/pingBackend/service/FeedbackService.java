package com.example.pingBackend.service;

import com.example.pingBackend.dto.request.FeedbackRequest;
import com.example.pingBackend.exception.ServiceUnavailableException;
import com.example.pingBackend.exception.TooManyRequestsException;
import com.example.pingBackend.model.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;

/**
 * Turns a submitted piece of feedback into an email to the developer.
 *
 * NOTHING IS SAVED. There is no repository here and no Mongo document: the
 * inbox is the storage. That's a deliberate scope choice — feedback is read
 * once by one person, so a collection to hold it would be a second copy of the
 * same text to secure, back up and eventually delete.
 *
 * WHAT GOES IN THE EMAIL is only what the feedback is about and who sent it:
 * type, message, username, email, user id, timestamp. No token, no password
 * hash, no conversation contents. The User object passed in has a password
 * field on it and this class never touches it.
 */
@Service
@Slf4j
public class FeedbackService {

    /**
     * Feedback sends an email, and an email costs real quota (Brevo's free tier
     * is 300 a day) and lands in a human's inbox. Without a limit, one signed-in
     * account could empty the day's quota — taking password reset emails down
     * with it — in a few seconds of clicking.
     */
    private static final int MAX_PER_WINDOW = 5;
    private static final Duration WINDOW = Duration.ofHours(1);

    /** Long enough for any real name, short enough that a subject line stays a subject line. */
    private static final int MAX_SUBJECT_NAME_LENGTH = 40;

    private static final DateTimeFormatter TIMESTAMP =
            DateTimeFormatter.ofPattern("d MMM yyyy 'at' HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private final EmailService emailService;
    private final MediaStorageService mediaStorageService;
    private final RateLimiter rateLimiter;
    private final String recipient;

    public FeedbackService(
            EmailService emailService,
            MediaStorageService mediaStorageService,
            RateLimiter rateLimiter,
            @Value("${feedback.recipient-email:}") String recipient
    ) {
        this.emailService = emailService;
        this.mediaStorageService = mediaStorageService;
        this.rateLimiter = rateLimiter;
        this.recipient = recipient;
    }

    /**
     * @param sender the AUTHENTICATED user — never a value from the request body
     */
    public void submit(FeedbackRequest request, MultipartFile screenshot, User sender) {
        if (recipient == null || recipient.isBlank()) {
            log.error("Feedback was submitted but FEEDBACK_RECIPIENT_EMAIL is not set — there is nowhere to send it.");
            throw new ServiceUnavailableException("Feedback isn't available right now. Please try again later.");
        }

        if (!rateLimiter.tryAcquire("feedback:user:" + sender.getId(), MAX_PER_WINDOW, WINDOW)) {
            throw new TooManyRequestsException(
                    "You've sent a few pieces of feedback just now. Please try again a little later.");
        }

        List<EmailService.Attachment> attachments =
                (screenshot == null || screenshot.isEmpty())
                        ? List.of()
                        : List.of(attachmentFor(screenshot));

        // Throws if Brevo won't take it, so a 204 from the controller really
        // does mean the email was accepted rather than merely attempted.
        emailService.sendNow(recipient, subjectFor(request.getType(), sender), bodyFor(request, sender), attachments);

        log.info("Feedback ({}) from user {} sent", request.getType(), sender.getId());
    }

    /**
     * Prepare the screenshot for Brevo.
     *
     * Runs through the SAME validation and sanitizing every other image in Ping
     * gets — real type sniffed from the bytes, allow-list, decode and re-encode.
     * An email attachment might feel like it deserves less care since it isn't
     * stored, but it is still a file from a stranger that we forward to a mail
     * provider and that somebody opens; re-encoding strips whatever was riding
     * along in it, including the EXIF GPS tag that would otherwise tell us where
     * the sender was standing.
     */
    private EmailService.Attachment attachmentFor(MultipartFile screenshot) {
        MediaStorageService.SanitizedImage image = mediaStorageService.validateImage(screenshot);

        String extension = switch (image.mimeType()) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };

        // The name is ours, not screenshot.getOriginalFilename(). A
        // client-supplied filename has no business being echoed into a mail
        // client that may treat it as a path.
        return new EmailService.Attachment(
                "screenshot." + extension,
                Base64.getEncoder().encodeToString(image.bytes()));
    }

    private static String subjectFor(FeedbackRequest.FeedbackType type, User sender) {
        return "[Ping Feedback] " + type.label() + " from @" + subjectSafe(sender.getUsername());
    }

    /**
     * A username is user-chosen text going into a header-like field.
     *
     * Brevo's HTTP API takes the subject as a JSON value, so this isn't the
     * classic SMTP header-injection hole where a newline invents a new header —
     * but stripping control characters costs nothing and means the subject stays
     * one line no matter what the account is called.
     */
    private static String subjectSafe(String username) {
        if (username == null || username.isBlank()) {
            return "unknown";
        }
        String cleaned = username.replaceAll("\\p{Cntrl}", "").trim();
        if (cleaned.isEmpty()) {
            return "unknown";
        }
        return cleaned.length() > MAX_SUBJECT_NAME_LENGTH
                ? cleaned.substring(0, MAX_SUBJECT_NAME_LENGTH) + "…"
                : cleaned;
    }

    /**
     * Build the email body.
     *
     * EVERY user-supplied value below goes through escapeHtml first. This is the
     * difference between this email and the password reset one: that template is
     * built only from values the server controls, so its comment can truthfully
     * say nothing in it could inject markup. This one is made almost entirely of
     * text a stranger typed. Dropped in raw, a message containing a script tag
     * or an anchor would render as live markup in whatever client opens it.
     */
    private static String bodyFor(FeedbackRequest request, User sender) {
        return """
                <div style="font-family:system-ui,sans-serif;max-width:640px;margin:auto;color:#1b2f35">
                  <h2 style="margin:0 0 16px">%s</h2>
                  <table style="border-collapse:collapse;font-size:14px;margin-bottom:20px">
                    <tr><td style="padding:4px 16px 4px 0;color:#738086">Feedback type</td><td><strong>%s</strong></td></tr>
                    <tr><td style="padding:4px 16px 4px 0;color:#738086">User</td><td>@%s</td></tr>
                    <tr><td style="padding:4px 16px 4px 0;color:#738086">Email</td><td>%s</td></tr>
                    <tr><td style="padding:4px 16px 4px 0;color:#738086">User ID</td><td><code>%s</code></td></tr>
                    <tr><td style="padding:4px 16px 4px 0;color:#738086">Submitted</td><td>%s</td></tr>
                  </table>
                  <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#738086;margin:0 0 8px">Message</p>
                  <div style="background:#f6f1e7;border-radius:12px;padding:16px;font-size:14px;line-height:1.6;white-space:normal">%s</div>
                </div>
                """.formatted(
                escapeHtml(request.getType().label()),
                escapeHtml(request.getType().name()),
                escapeHtml(sender.getUsername()),
                escapeHtml(sender.getEmail() == null || sender.getEmail().isBlank() ? "not provided" : sender.getEmail()),
                escapeHtml(sender.getId()),
                TIMESTAMP.format(Instant.now()),
                // Escape FIRST, then turn newlines into breaks. The other order
                // would escape the <br> tags we just added and print them.
                escapeHtml(request.getMessage()).replace("\n", "<br>"));
    }

    /**
     * Make text safe to place inside HTML.
     *
     * The ampersand must be replaced FIRST. Doing it later would find the
     * ampersands in the entities the other replacements just wrote and mangle
     * them — "&lt;" would become "&amp;lt;" and the reader would see the raw
     * escape instead of a less-than sign.
     */
    private static String escapeHtml(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
