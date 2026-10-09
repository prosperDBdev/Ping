package com.example.pingBackend.service;

import com.example.pingBackend.model.User;
import com.example.pingBackend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BroadcastService {

    private final UserRepository userRepository;
    private final EmailService emailService;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public record BroadcastResult(int totalRecipients, List<String> recipientEmails, String statusMessage) {}

    /**
     * Broadcasts announcement/reminder emails to registered users.
     *
     * @param customSubject Optional custom subject override
     * @param customMessage Optional custom message body paragraph
     * @return Summary of recipients and dispatch status
     */
    public BroadcastResult sendBroadcast(String customSubject, String customMessage) {
        List<User> users = userRepository.findAll();
        List<String> emails = users.stream()
                .map(User::getEmail)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(e -> !e.isBlank() && e.contains("@"))
                .distinct()
                .collect(Collectors.toList());

        if (emails.isEmpty()) {
            log.info("No registered users with valid email addresses found for broadcast.");
            return new BroadcastResult(0, List.of(), "No valid recipient email addresses found.");
        }

        String subject = (customSubject != null && !customSubject.isBlank())
                ? customSubject
                : "🚀 Discover What's New on Ping!";

        String htmlContent = buildBroadcastHtml(customMessage);

        int count = 0;
        for (String email : emails) {
            try {
                // Queues asynchronously in EmailService thread pool
                emailService.sendNow(email, subject, htmlContent, null);
                count++;
            } catch (Exception e) {
                log.error("Failed to send broadcast email to {}: {}", email, e.getMessage());
            }
        }

        log.info("Successfully queued/sent broadcast email to {} registered user(s)", count);
        return new BroadcastResult(count, emails, "Broadcast successfully dispatched to " + count + " recipient(s).");
    }

    private String buildBroadcastHtml(String customMessage) {
        String customBlock = (customMessage != null && !customMessage.isBlank())
                ? "<div style='background:#1e293b;border-left:4px solid #38bdf8;padding:14px;margin-bottom:20px;border-radius:4px;color:#f1f5f9;font-size:14px;'>"
                  + customMessage + "</div>"
                : "";

        String appLink = (frontendUrl != null && !frontendUrl.isBlank()) ? frontendUrl : "https://155.133.27.51";

        return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Ping Update & Reminder</title>
            </head>
            <body style="margin:0;padding:0;background-color:#0b1329;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
                <div style="max-width:600px;margin:30px auto;background:#1e293b;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.5);border:1px solid #334155;">
                    <!-- Header Banner -->
                    <div style="background:linear-gradient(135deg, #0ea5e9 0%%, #6366f1 100%%);padding:36px 28px;text-align:center;">
                        <h1 style="margin:0;font-size:32px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">PING</h1>
                        <p style="margin:8px 0 0;font-size:16px;color:#e0f2fe;font-weight:500;">Connect, Chat & Share – Anywhere, Anytime</p>
                    </div>
                    
                    <!-- Content Body -->
                    <div style="padding:32px 28px;">
                        <h2 style="margin:0 0 16px;color:#38bdf8;font-size:22px;font-weight:700;">Welcome & Reminder 🎉</h2>
                        <p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin-bottom:20px;">
                            Thank you for registering on <strong>Ping</strong>! We've built powerful new features to ensure your messaging experience is seamless, ultra-secure, and lightning-fast.
                        </p>

                        %s

                        <!-- Feature Highlights Box -->
                        <div style="background:#0f172a;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #1e293b;">
                            <h3 style="margin:0 0 16px;color:#818cf8;font-size:16px;font-weight:700;">✨ What's New & Ready to Test:</h3>
                            
                            <div style="margin-bottom:14px;">
                                <strong style="color:#f8fafc;font-size:14px;">🎵 Interactive Voice Note Scrubbing:</strong>
                                <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;line-height:1.5;">Tap or drag anywhere on a voice message timeline to scrub and replay exact audio parts.</p>
                            </div>
                            
                            <div style="margin-bottom:14px;">
                                <strong style="color:#f8fafc;font-size:14px;">📶 Offline Safeguard & Auto-Sync:</strong>
                                <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;line-height:1.5;">Never lose a message. Messages queue safely when offline and send automatically the moment internet returns.</p>
                            </div>
                            
                            <div style="margin-bottom:14px;">
                                <strong style="color:#f8fafc;font-size:14px;">🔒 End-to-End Encryption & Pinned Chats:</strong>
                                <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;line-height:1.5;">Your messages stay private and encrypted across all accounts, with instant chat pinning.</p>
                            </div>
                        </div>

                        <p style="font-size:15px;line-height:1.6;color:#cbd5e1;margin-bottom:24px;">
                            Invite your family and friends to join you on Ping and test out these exciting new features today!
                        </p>

                        <!-- CTA Button -->
                        <div style="text-align:center;margin:32px 0 16px;">
                            <a href="%s" style="background:linear-gradient(135deg, #0284c7 0%%, #4f46e5 100%%);color:#ffffff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;box-shadow:0 4px 14px rgba(2,132,199,0.4);">
                                Open Ping & Start Chatting
                            </a>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div style="background:#0f172a;padding:20px;text-align:center;border-top:1px solid #1e293b;color:#64748b;font-size:12px;">
                        <p style="margin:0;">Sent with ❤️ from the Ping Team.</p>
                        <p style="margin:4px 0 0;">If you did not register for Ping, you can safely ignore this email.</p>
                    </div>
                </div>
            </body>
            </html>
            """.formatted(customBlock, appLink);
    }
}
