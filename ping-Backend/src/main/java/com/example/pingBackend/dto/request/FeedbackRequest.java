package com.example.pingBackend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * One piece of feedback on its way to the developer's inbox.
 *
 * NOTE WHAT ISN'T HERE: any notion of who sent it. No userId, no username, no
 * email. Those are read from the authenticated principal in the controller,
 * because anything in this object came from the browser and the browser is
 * allowed to put whatever it likes in it. An identity field here would be a
 * field an attacker gets to fill in.
 *
 * The screenshot isn't here either — it arrives as a separate multipart part,
 * since a file isn't a form field.
 */
@Data
public class FeedbackRequest {

    @NotNull(message = "Choose what kind of feedback this is")
    private FeedbackType type;

    @NotBlank(message = "Please tell us a little about it")
    @Size(max = 5000, message = "Feedback can be at most 5000 characters")
    private String message;

    /**
     * An enum rather than a free string, so "what kind of feedback is this?"
     * is answered by the type system. A value outside this set fails to bind
     * and comes back as a 400 without any code of ours having to check it.
     */
    public enum FeedbackType {
        BUG_REPORT("Bug Report"),
        FEATURE_REQUEST("Feature Request"),
        GENERAL("General");

        private final String label;

        FeedbackType(String label) {
            this.label = label;
        }

        /** How this reads in an email subject line. */
        public String label() {
            return label;
        }
    }
}
