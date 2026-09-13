package com.example.pingBackend.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Message {

    @Id
    private String id;

    private String conversationId;
    private String senderId;
    private String senderUsername;
    private String content;

    @Builder.Default
    private String type = "TEXT"; // TEXT, IMAGE, FILE, VOICE, SYSTEM

    @Builder.Default
    private String status = "SENT"; // SENT, DELIVERED, SEEN

    @Builder.Default
    private List<String> seenBy = new ArrayList<>();

    // Present when type is VOICE (or later, IMAGE/FILE). Null for plain text messages.
    private Attachment attachment;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /**
     * Set when this message is a reply to someone's status.
     *
     * A SNAPSHOT, not a reference, and that's the point. The status this quotes
     * is deleted 24 hours after it was posted, but the reply lives in a chat
     * forever. If this held only a statusId, every status reply in every
     * conversation would turn into a dangling pointer overnight — a quote card
     * with nothing to show. Copying the few fields the quote needs means the
     * reply keeps its context after the thing it replied to is gone.
     *
     * Deliberately no media key. Copying one in would let the chat try to fetch
     * a status image after the status expired, which the media endpoint rightly
     * refuses. A label saying it was a photo is honest; a broken image is not.
     */
    private StatusReply statusReply;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatusReply {
        private String statusId;
        private String statusAuthorId;
        private String statusType;       // TEXT or IMAGE
        private String snippet;          // the status text, trimmed for display
        private String backgroundColor;  // TEXT statuses only
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Attachment {
        // Object storage key (e.g. "voice-notes/<conversationId>/<uuid>.webm") —
        // deliberately NOT a public URL. A short-lived signed URL is minted on
        // request by the media-retrieval endpoint, once that's built, so access
        // can be checked (is this requester actually a participant?) every time.
        private String key;
        private String mimeType;
        private long sizeBytes;
        private Integer durationSeconds; // voice notes only; null otherwise

        // Display-only. The uploader's original filename is untrusted input and
        // is deliberately NOT used to build the storage key (that stays a
        // server-generated UUID), but it's safe to keep for showing in the
        // Files panel — as long as it's only ever rendered as text, which React
        // escapes by default.
        private String fileName;
    }
}