package com.example.pingBackend.service;

import com.example.pingBackend.config.BrevoProperties;
import com.example.pingBackend.exception.ServiceUnavailableException;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Sends email through Brevo's HTTP API.
 *
 * WHY HTTP AND NOT SMTP. Brevo offers both. The HTTP API is one POST with a JSON
 * body and an API key header — no mail library, no SMTP connection to manage,
 * and free hosts often block outbound SMTP ports anyway.
 *
 * WHY IN THE BACKGROUND. Sending takes a network round-trip to Brevo, often a
 * few hundred milliseconds. If the forgot-password request waited for it, the
 * response would come back noticeably slower when the email EXISTS (an email is
 * sent) than when it doesn't (nothing to send) — and an attacker timing the
 * responses could learn which emails have accounts. Queuing the send and
 * answering immediately removes most of that difference.
 *
 * The small thread pool is private to this class on purpose. Declaring it as a
 * Spring Executor bean would silently switch off Spring Boot's own default task
 * executor — the same kind of invisible bean conflict that once stopped every
 * @Scheduled job in this app from running.
 *
 * WITHOUT AN API KEY (local development) nothing is sent. On localhost the reset
 * link is written to the log so you can still test the flow. Anywhere else it is
 * NOT logged: a reset link is a key to someone's account, and server logs are
 * read by far more people and tools than a user's inbox.
 */
@Service
@Slf4j
public class EmailService {

    private final RestClient restClient = RestClient.builder()
            .baseUrl("https://api.brevo.com/v3")
            .build();

    // One sender thread, at most 100 waiting emails. If the queue is ever full,
    // the email is dropped and logged rather than letting a flood of requests
    // pile up unbounded work in memory.
    private final ThreadPoolExecutor sender = new ThreadPoolExecutor(
            1, 1, 0L, TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(100),
            runnable -> {
                Thread thread = new Thread(runnable, "ping-email");
                thread.setDaemon(true);
                return thread;
            },
            (runnable, executor) -> log.error("Email queue full — an email was dropped"));

    // One object rather than three strings: the three brevo.* values are only
    // ever meaningful together, and binding them once means this constructor
    // doesn't have to restate their property names and defaults.
    private final BrevoProperties brevo;
    private final String frontendUrl;

    public EmailService(BrevoProperties brevo, @Value("${app.frontend-url}") String frontendUrl) {
        this.brevo = brevo;
        this.frontendUrl = frontendUrl;
    }

    public boolean isConfigured() {
        return brevo.isConfigured();
    }

    /** Queues a password reset email and returns immediately. */
    public void sendPasswordReset(String toEmail, String resetLink) {
        sender.execute(() -> deliverPasswordReset(toEmail, resetLink));
    }

    private void deliverPasswordReset(String toEmail, String resetLink) {
        if (!isConfigured()) {
            if (frontendUrl.startsWith("http://localhost")) {
                log.warn("EMAIL NOT CONFIGURED (local development) — password reset link for {}: {}",
                        toEmail, resetLink);
            } else {
                log.error("Email is not configured: set BREVO_API_KEY and BREVO_SENDER_EMAIL. "
                        + "A password reset was requested and no email was sent.");
            }
            return;
        }

        try {
            postToBrevo(Map.of(
                    "sender", Map.of("name", brevo.senderName(), "email", brevo.senderEmail()),
                    "to", List.of(Map.of("email", toEmail)),
                    "subject", "Reset your Ping password",
                    "htmlContent", resetEmailHtml(resetLink)));
            log.info("Password reset email handed to Brevo");
        } catch (RestClientException e) {
            // Logged without the link or the token — only that it failed and why.
            log.error("Brevo rejected the password reset email: {}", e.getMessage());
        }
    }

    /**
     * Built only from values the server controls — the configured frontend URL
     * and a server-generated token. No user-supplied text goes into this HTML,
     * so there's nothing in it that could inject markup into someone's inbox.
     */
    private static String resetEmailHtml(String resetLink) {
        return """
                <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#1b2f35">
                  <h2 style="margin:0 0 12px">Reset your Ping password</h2>
                  <p>Someone asked to reset the password for this account. If it was you, use the button below.
                     It works once and expires in 15 minutes.</p>
                  <p style="margin:24px 0">
                    <a href="%s" style="background:#e0684b;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">
                      Choose a new password
                    </a>
                  </p>
                  <p style="color:#738086;font-size:13px">If you didn't ask for this, you can ignore this email — your password won't change.</p>
                </div>
                """.formatted(resetLink);
    }

    /** One file to travel with an email, already base64-encoded as Brevo wants it. */
    public record Attachment(String fileName, String base64Content) {}

    /**
     * Send an email on the CALLING thread and fail loudly if Brevo won't take it.
     *
     * WHY THIS EXISTS ALONGSIDE sendPasswordReset, which queues instead.
     *
     * The queueing there is a security measure, not a performance one: it stops
     * the response time of "forgot password" from revealing whether an address
     * has an account, because a request that sends an email and one that doesn't
     * then take the same time. Answering before the send finishes is the whole
     * point, and it means the caller can never learn whether it worked.
     *
     * Neither half of that applies to feedback. The sender is signed in and is
     * writing about themselves, so there is nothing to leak by timing — and the
     * caller genuinely needs to know the outcome, because the person is waiting
     * to be told their feedback arrived. Telling them it did when it silently
     * failed would be worse than a slower response.
     *
     * @throws ServiceUnavailableException if email isn't configured, or Brevo
     *                                     refused the message
     */
    public void sendNow(String toEmail, String subject, String htmlContent, List<Attachment> attachments) {
        if (!isConfigured()) {
            log.error("Email is not configured: set BREVO_API_KEY and BREVO_SENDER_EMAIL. Nothing was sent.");
            throw new ServiceUnavailableException("We can't send that right now. Please try again later.");
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sender", Map.of("name", brevo.senderName(), "email", brevo.senderEmail()));
        body.put("to", List.of(Map.of("email", toEmail)));
        body.put("subject", subject);
        body.put("htmlContent", htmlContent);
        if (attachments != null && !attachments.isEmpty()) {
            body.put("attachment", attachments.stream()
                    .map(a -> Map.of("name", a.fileName(), "content", a.base64Content()))
                    .toList());
        }

        try {
            postToBrevo(body);
        } catch (RestClientException e) {
            // The detail stays HERE. Brevo's refusals quote our account state,
            // plan limits and the recipient address, and a RestClientException
            // message can carry the whole response body — none of which belongs
            // in an API response. The caller gets a sentence written for a
            // person; this line is how the developer finds out what happened.
            log.error("Brevo rejected an email: {}", e.getMessage());
            throw new ServiceUnavailableException(
                    "We couldn't send that right now. Please try again in a moment.");
        }
    }

    /**
     * The one place in this application that talks to Brevo.
     *
     * Protected rather than private so a test can subclass this service and
     * override it, simulating acceptance and refusal without a network call or
     * a real API key. That keeps the API key out of the test suite entirely:
     * there is no configuration a test needs in order to exercise what happens
     * when sending fails.
     */
    protected void postToBrevo(Map<String, ?> body) {
        restClient.post()
                .uri("/smtp/email")
                .header("api-key", brevo.apiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    @PreDestroy
    void shutdown() {
        sender.shutdown();
    }
}
