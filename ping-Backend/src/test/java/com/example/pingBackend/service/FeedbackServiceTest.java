package com.example.pingBackend.service;

import com.example.pingBackend.config.BrevoProperties;
import com.example.pingBackend.dto.request.FeedbackRequest;
import com.example.pingBackend.exception.ServiceUnavailableException;
import com.example.pingBackend.exception.TooManyRequestsException;
import com.example.pingBackend.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Feedback submission.
 *
 * NO NETWORK AND NO API KEY. EmailService exposes exactly one method that talks
 * to Brevo (postToBrevo), and it's protected precisely so a test can subclass
 * and replace it. That's what the double below does: it captures the JSON body
 * that WOULD have been posted, or throws to simulate Brevo refusing. So every
 * assertion here is about the message we actually built, and the suite needs no
 * credentials to run.
 *
 * The rate limiter and the HTML building are the real ones — they're part of
 * what's under test.
 */
class FeedbackServiceTest {

    private static final String RECIPIENT = "dev@ping.test";
    private static final String FAKE_API_KEY = "test-api-key-not-real";

    /** The body handed to Brevo by the most recent send, or null if none got that far. */
    private Map<String, ?> lastEmail;
    private boolean brevoRefuses;
    private int sendAttempts;

    private User sender;
    private FeedbackService service;

    @BeforeEach
    void setUp() {
        lastEmail = null;
        brevoRefuses = false;
        sendAttempts = 0;

        sender = User.builder()
                .id("user-1")
                .username("maya")
                .email("maya@example.com")
                // A password hash is on every real User object, which is exactly
                // why one is here: the email must never carry it.
                .password("$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG")
                .build();

        service = newService(RECIPIENT);
    }

    private FeedbackService newService(String recipient) {
        return new FeedbackService(email(), storage(), new RateLimiter(), recipient);
    }

    private EmailService email() {
        // Configured with obvious fakes so isConfigured() is true and the
        // "not configured" branch isn't what's being exercised.
        BrevoProperties brevo = new BrevoProperties(FAKE_API_KEY, "ping@example.test", "Ping");
        return new EmailService(brevo, "http://localhost:3000") {
            @Override
            protected void postToBrevo(Map<String, ?> body) {
                sendAttempts++;
                if (brevoRefuses) {
                    // Shaped like a real failure: Brevo's refusals quote account
                    // state back at you, and that text must not escape the server.
                    throw new RestClientException(
                            "401 Unauthorized: {\"code\":\"unauthorized\","
                                    + "\"message\":\"Key not found: " + FAKE_API_KEY + "\"}");
                }
                lastEmail = body;
            }
        };
    }

    private MediaStorageService storage() {
        // Constructor only assigns fields, so nulls are safe; the one method
        // feedback uses is replaced with a known result.
        return new MediaStorageService(null, null, null) {
            @Override
            public SanitizedImage validateImage(MultipartFile file) {
                return new SanitizedImage(new byte[]{1, 2, 3, 4}, "image/png");
            }
        };
    }

    private static FeedbackRequest request(FeedbackRequest.FeedbackType type, String message) {
        FeedbackRequest request = new FeedbackRequest();
        request.setType(type);
        request.setMessage(message);
        return request;
    }

    private String htmlContent() {
        assertNotNull(lastEmail, "no email was built");
        return (String) lastEmail.get("htmlContent");
    }

    // ------------------------------------------------------------------ sending

    @Test
    @DisplayName("a valid submission is emailed to the configured address")
    void validSubmissionIsSent() {
        service.submit(request(FeedbackRequest.FeedbackType.BUG_REPORT, "The moments tab is blank"), null, sender);

        assertEquals(1, sendAttempts);
        assertEquals(List.of(Map.of("email", RECIPIENT)), lastEmail.get("to"));
        assertEquals("[Ping Feedback] Bug Report from @maya", lastEmail.get("subject"));
    }

    @Test
    @DisplayName("the email carries the feedback type, user, email, id and message")
    void emailCarriesTheDetails() {
        service.submit(request(FeedbackRequest.FeedbackType.FEATURE_REQUEST, "Add dark mode to moments"), null, sender);

        String html = htmlContent();
        assertTrue(html.contains("FEATURE_REQUEST"), html);
        assertTrue(html.contains("@maya"), html);
        assertTrue(html.contains("maya@example.com"), html);
        assertTrue(html.contains("user-1"), html);
        assertTrue(html.contains("Add dark mode to moments"), html);
    }

    @Test
    @DisplayName("each feedback type gets its own subject line")
    void subjectPerType() {
        service.submit(request(FeedbackRequest.FeedbackType.GENERAL, "hello"), null, sender);
        assertEquals("[Ping Feedback] General from @maya", lastEmail.get("subject"));
    }

    @Test
    @DisplayName("identity comes from the authenticated user, not from anything in the request")
    void identityComesFromTheAuthenticatedUser() {
        // The only place a username, email or id can come from is this object —
        // FeedbackRequest has no such fields to be filled in by a caller. The
        // closest a forged value can get is the message body, where it's inert
        // text rather than a claim about who sent this.
        User someoneElse = User.builder().id("user-2").username("sam").email("sam@example.com").build();

        service.submit(request(FeedbackRequest.FeedbackType.GENERAL, "userId=user-1&username=maya"), null, someoneElse);

        assertEquals("[Ping Feedback] General from @sam", lastEmail.get("subject"));
        assertTrue(htmlContent().contains("user-2"), "the sender's real id should be reported");
    }

    // -------------------------------------------------------------- screenshots

    @Test
    @DisplayName("a screenshot is attached under a server-chosen filename")
    void screenshotIsAttached() {
        MultipartFile shot = new MockMultipartFile(
                "screenshot", "../../etc/passwd.png", "image/png", new byte[]{9, 9, 9});

        service.submit(request(FeedbackRequest.FeedbackType.BUG_REPORT, "see attached"), shot, sender);

        @SuppressWarnings("unchecked")
        List<Map<String, String>> attachments = (List<Map<String, String>>) lastEmail.get("attachment");
        assertEquals(1, attachments.size());
        // The client's filename — a path-traversal attempt here — is discarded.
        assertEquals("screenshot.png", attachments.get(0).get("name"));
        // And the content is what the sanitizer produced, base64-encoded.
        assertEquals("AQIDBA==", attachments.get(0).get("content"));
    }

    @Test
    @DisplayName("no screenshot means no attachment field at all")
    void noScreenshotNoAttachment() {
        service.submit(request(FeedbackRequest.FeedbackType.GENERAL, "just text"), null, sender);
        assertFalse(lastEmail.containsKey("attachment"));
    }

    @Test
    @DisplayName("an empty file part is treated as no screenshot")
    void emptyScreenshotIgnored() {
        MultipartFile empty = new MockMultipartFile("screenshot", "", "image/png", new byte[0]);

        service.submit(request(FeedbackRequest.FeedbackType.GENERAL, "no picture"), empty, sender);

        assertFalse(lastEmail.containsKey("attachment"));
    }

    // ------------------------------------------------------------------ escaping

    @Test
    @DisplayName("markup in the message is escaped, not rendered")
    void messageIsEscaped() {
        service.submit(request(FeedbackRequest.FeedbackType.BUG_REPORT,
                "<script>alert('x')</script> & <b>bold</b>"), null, sender);

        String html = htmlContent();
        assertFalse(html.contains("<script>"), "raw script tag reached the email body");
        assertTrue(html.contains("&lt;script&gt;"), html);
        // The ampersand was escaped once, not twice — "&amp;lt;" would mean the
        // reader sees the escape sequence instead of a less-than sign.
        assertFalse(html.contains("&amp;lt;"), "double-escaped");
    }

    @Test
    @DisplayName("a username containing markup can't inject into the body either")
    void usernameIsEscaped() {
        User tricky = User.builder().id("u9").username("<img src=x onerror=alert(1)>").email("t@x.com").build();

        service.submit(request(FeedbackRequest.FeedbackType.GENERAL, "hi"), null, tricky);

        assertFalse(htmlContent().contains("<img src=x"), htmlContent());
    }

    @Test
    @DisplayName("newlines in the message survive as line breaks")
    void newlinesBecomeBreaks() {
        service.submit(request(FeedbackRequest.FeedbackType.GENERAL, "line one\nline two"), null, sender);
        assertTrue(htmlContent().contains("line one<br>line two"), htmlContent());
    }

    // ----------------------------------------------------------------- failures

    @Test
    @DisplayName("when Brevo refuses, the caller gets a safe message with no internals in it")
    void brevoFailureIsSafe() {
        brevoRefuses = true;

        ServiceUnavailableException thrown = assertThrows(ServiceUnavailableException.class,
                () -> service.submit(request(FeedbackRequest.FeedbackType.BUG_REPORT, "broken"), null, sender));

        String message = thrown.getMessage();
        assertFalse(message.contains(FAKE_API_KEY), "the API key reached the user-facing message");
        assertFalse(message.contains("Brevo"), "the provider was named to the user");
        assertFalse(message.contains("401"), "the upstream status reached the user");
        assertFalse(message.toLowerCase().contains("exception"), message);
        assertEquals(503, thrown.getStatus().value());
    }

    @Test
    @DisplayName("with no recipient configured, nothing is sent and nothing is claimed")
    void unconfiguredRecipientRefuses() {
        FeedbackService unconfigured = newService("");

        assertThrows(ServiceUnavailableException.class,
                () -> unconfigured.submit(request(FeedbackRequest.FeedbackType.GENERAL, "hello"), null, sender));

        assertEquals(0, sendAttempts);
        assertNull(lastEmail);
    }

    @Test
    @DisplayName("the API key and sender configuration never appear in the email body")
    void configurationNeverLeaks() {
        service.submit(request(FeedbackRequest.FeedbackType.GENERAL, "hello"), null, sender);

        String html = htmlContent();
        assertFalse(html.contains(FAKE_API_KEY), "API key in the email body");
        assertFalse(html.contains(sender.getPassword()), "password hash in the email body");
        assertFalse(html.toLowerCase().contains("password"), html);
    }

    // -------------------------------------------------------------- rate limits

    @Test
    @DisplayName("a sixth submission within the hour is refused")
    void rateLimited() {
        for (int i = 0; i < 5; i++) {
            final int n = i;
            assertDoesNotThrow(() ->
                    service.submit(request(FeedbackRequest.FeedbackType.GENERAL, "message " + n), null, sender));
        }

        assertThrows(TooManyRequestsException.class,
                () -> service.submit(request(FeedbackRequest.FeedbackType.GENERAL, "one too many"), null, sender));

        assertEquals(5, sendAttempts, "the refused submission should not have been sent");
    }

    @Test
    @DisplayName("one user using up their allowance doesn't stop anybody else")
    void limitIsPerUser() {
        for (int i = 0; i < 5; i++) {
            service.submit(request(FeedbackRequest.FeedbackType.GENERAL, "mine"), null, sender);
        }

        User other = User.builder().id("user-2").username("sam").email("sam@example.com").build();
        assertDoesNotThrow(() ->
                service.submit(request(FeedbackRequest.FeedbackType.GENERAL, "theirs"), null, other));
    }
}
