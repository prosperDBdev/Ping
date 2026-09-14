package com.example.pingBackend.service;

import com.example.pingBackend.model.Conversation;
import com.example.pingBackend.model.Message;
import com.example.pingBackend.repository.ConversationRepository;
import com.example.pingBackend.repository.MessageRepository;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Iterator;
import java.util.Set;
import java.util.UUID;
import com.example.pingBackend.exception.NotFoundException;
import com.example.pingBackend.exception.ForbiddenMediaAccessException;
import com.example.pingBackend.exception.InvalidMediaException;

/**
 * Validates and stores a recorded voice note in object storage (Cloudflare R2).
 *
 * This is the one piece of Stage 6 you're writing yourself — everything that calls
 * into this class (the controller, the config, the DTOs) is already wired up, so once
 * uploadVoiceNote() below actually works, you can record a voice note in the browser
 * and see it round-trip for real.
 */
@Service
public class MediaStorageService {

    private final S3Client s3Client;
    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;

    @Value("${r2.bucket-name}")
    private String bucketName;

    // Business rule, enforced here — not the same as the 10MB Spring lets through
    // the door. This is the number that should actually produce a rejection.
    private static final long MAX_VOICE_NOTE_BYTES = 8L * 1024 * 1024; // 8MB

    // The allow-list. Anything Tika detects that ISN'T in here gets rejected,
    // no matter what the client claimed the file was.
    //
    // "application/x-matroska" and "video/webm" are in here on purpose: WebM
    // (what the browser's MediaRecorder actually produces) is a constrained
    // profile of the Matroska container format, and Tika's magic-byte
    // detection recognizes the container signature, not the fact that this
    // particular file only has an audio track — verified by actually
    // recording a real browser voice note and running it through Tika:
    // it came back as "application/x-matroska", not "audio/webm".
    private static final Set<String> ALLOWED_AUDIO_TYPES = Set.of(
            "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav",
            "application/x-matroska", "video/webm"
    );

    private static final long MAX_IMAGE_BYTES = 10L * 1024 * 1024; // 10MB on the wire

    /**
     * Total pixels we're willing to decode. 40 megapixels is comfortably above
     * any real phone photo (a 48MP camera shot is ~8000x6000 = 48MP, so this
     * sits just under that and can be raised if needed) and far below the
     * point where decoding exhausts heap.
     *
     * This limit exists because MAX_IMAGE_BYTES does NOT protect the decoder.
     * A ~2MB PNG can declare 50000x50000 dimensions and expand to roughly 10GB
     * once decoded to raw pixels. File size and decoded size are unrelated
     * numbers, and only one of them is what actually gets allocated.
     */
    private static final long MAX_IMAGE_PIXELS = 40_000_000L;

    /**
     * Longest edge we keep. A chat never displays more than this, so anything
     * bigger is bytes nobody sees — and on a 10GB free tier that adds up fast.
     * A 12MP phone photo lands around a few hundred KB after this.
     */
    private static final int MAX_IMAGE_DIMENSION = 2048;

    // Raster formats only, and deliberately narrow.
    //
    // SVG is absent because it is an XML document that can carry script — an
    // executable format wearing an image's file extension — and unlike a real
    // bitmap there is no "decode to pixels and re-encode" step that would
    // neutralize it.
    //
    // GIF is absent because sanitizing one means decoding it to a pixel grid,
    // which keeps only the first frame. Rather than silently turning someone's
    // animation into a still image with no explanation, we refuse it outright:
    // a clear rejection beats quietly mangling what the user sent.
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp"
    );

    public MediaStorageService(
            S3Client s3Client,
            MessageRepository messageRepository,
            ConversationRepository conversationRepository
    ) {
        this.s3Client = s3Client;
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
    }

    /**
     * Validate and store one recorded voice note.
     *
     * Requirements — all of these need to hold before you trust or store anything:
     *
     *   1. Reject if {@code file.isEmpty()} or {@code file.getSize() > MAX_VOICE_NOTE_BYTES}.
     *      Don't trust the client to have enforced its own recording-length cap.
     *
     *   2. Determine the file's REAL content type by sniffing its bytes — NOT by
     *      reading {@code file.getContentType()}, which is a header the client sends
     *      and can set to anything it wants. (See the Tika reference below.)
     *
     *   3. Reject if that real type isn't in ALLOWED_AUDIO_TYPES. This is the actual
     *      security check — the extension/header lie, the byte signature doesn't.
     *
     *   4. Generate a random, unpredictable object key. Never derive it from
     *      file.getOriginalFilename() — a client-supplied filename in a storage path
     *      is exactly how path-traversal and overwrite bugs happen. Something like
     *      "voice-notes/{uploaderId}/{UUID}" is the right shape.
     *
     *   5. Upload the bytes to R2 under that key (see the S3 reference below).
     *
     *   6. Return a StoredMedia with the key, the REAL content type from step 2, and
     *      the actual size — never values the client handed you.
     *
     * Throw {@link InvalidMediaException} with a clear message for any rejection in
     * steps 1 or 3 — MediaController already turns that into a clean 400 response.
     *
     * ---- Reference: library calls you'll need, so you're not fighting unfamiliar
     * ---- SDK syntax instead of the actual logic.
     *
     * Detecting the real type from bytes (Apache Tika):
     *   org.apache.tika.Tika tika = new org.apache.tika.Tika();
     *   String realType = tika.detect(someByteArray);
     *
     * Uploading to R2 (AWS SDK v2 — R2 speaks the same protocol):
     *   software.amazon.awssdk.services.s3.model.PutObjectRequest request =
     *       software.amazon.awssdk.services.s3.model.PutObjectRequest.builder()
     *           .bucket(bucketName)
     *           .key(objectKey)
     *           .contentType(realType)
     *           .build();
     *   s3Client.putObject(request,
     *       software.amazon.awssdk.core.sync.RequestBody.fromBytes(fileBytes));
     *
     * One gotcha: MultipartFile.getInputStream() gives you a stream, and streams
     * can only be read once. If you read it for Tika detection and then try to read
     * it again for the upload, the second read may come back empty. Easiest fix:
     * call file.getBytes() ONCE, keep that byte array, and use it for both the
     * Tika check and the upload. That's safe here specifically because of the 8MB
     * cap in requirement 1 — loading the whole file into memory only stays cheap
     * because the size is bounded. (This is also exactly why the cap matters beyond
     * just storage cost — it's what makes this simplification safe.)
     *
     * @throws InvalidMediaException if the file is missing, too large, or isn't a
     *                               real audio file
     */
    public StoredMedia uploadVoiceNote(MultipartFile file, String uploaderId) {
        if (file.isEmpty() || file.getSize() > MAX_VOICE_NOTE_BYTES) {
            throw new InvalidMediaException("Voice note is empty or exceeds the 8MB limit");
        }

        byte[] fileBytes;
        try {
            fileBytes = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded voice note", e);
        }

        String realType = new Tika().detect(fileBytes);
        if (!ALLOWED_AUDIO_TYPES.contains(realType)) {
            throw new InvalidMediaException("Unsupported audio type: " + realType);
        }

        String objectKey = "voice-notes/" + uploaderId + "/" + UUID.randomUUID();

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(objectKey)
                .contentType(realType)
                .build();
        s3Client.putObject(request, RequestBody.fromBytes(fileBytes));

        return new StoredMedia(objectKey, realType, fileBytes.length);
    }

    /**
     * Validate, sanitize and store an uploaded image.
     *
     * Same shape as uploadVoiceNote, with one crucial addition: the bytes that
     * reach R2 are NOT the bytes the user uploaded. They're re-encoded first
     * (see sanitizeImage), so what we store and later serve was produced by our
     * own encoder from decoded pixel data.
     */
    public StoredMedia uploadImage(MultipartFile file, String uploaderId) {
        return storeSanitizedImage(file, uploaderId, "images/");
    }

    /**
     * Same pipeline, different shelf: an image posted as a 24-hour status.
     *
     * Stored under its own key prefix purely so the two kinds of image are
     * distinguishable in the bucket — status objects are short-lived and get
     * swept by ExpiredStatusCleanupJob, chat attachments live as long as their
     * message does. Everything about the safety treatment is identical, which
     * is the point: there is one image intake path in this codebase, and
     * adding a second place images can enter would mean a second place to get
     * the sanitizing wrong.
     */
    public StoredMedia uploadStatusImage(MultipartFile file, String uploaderId) {
        return storeSanitizedImage(file, uploaderId, "statuses/");
    }

    private StoredMedia storeSanitizedImage(MultipartFile file, String uploaderId, String keyPrefix) {
        if (file.isEmpty() || file.getSize() > MAX_IMAGE_BYTES) {
            throw new InvalidMediaException("Image is empty or exceeds the 10MB limit");
        }

        byte[] originalBytes;
        try {
            originalBytes = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded image", e);
        }

        String realType = new Tika().detect(originalBytes);
        if (!ALLOWED_IMAGE_TYPES.contains(realType)) {
            throw new InvalidMediaException("Unsupported image type: " + realType);
        }

        // Everything after this point deals in OUR bytes, not the uploader's.
        SanitizedImage sanitized = sanitizeImage(originalBytes, realType);

        String objectKey = keyPrefix + uploaderId + "/" + UUID.randomUUID();

        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(objectKey)
                .contentType(sanitized.mimeType())
                .build();
        s3Client.putObject(request, RequestBody.fromBytes(sanitized.bytes()));

        return new StoredMedia(objectKey, sanitized.mimeType(), sanitized.bytes().length);
    }

    /** The output of re-encoding: our own bytes, and the type we produced. */
    public record SanitizedImage(byte[] bytes, String mimeType) {}

    /**
     * Re-encode an image so that what gets stored contains nothing but pixels.
     *
     * THIS IS YOURS TO WRITE. It's the piece of Stage 8 with the actual
     * security content in it — the rest (limits, allow-list, storage, serving
     * headers) is already wired around it.
     *
     * The idea: you are not inspecting the file for bad content and removing
     * it. You decode it to raw pixels and write a brand-new file from those
     * pixels. EXIF, appended trailing data, embedded scripts, polyglot
     * payloads — all gone by construction, because none of them are pixels and
     * nothing copies them across. That's why this beats trying to detect
     * badness: it doesn't need to know what the payload was.
     *
     * WHAT IT NEEDS TO DO, and the order genuinely matters:
     *
     *   1. Read the image's DIMENSIONS WITHOUT DECODING IT, and reject if
     *      width * height > MAX_IMAGE_PIXELS.
     *
     *      This must come FIRST. If you call ImageIO.read() before checking,
     *      you've already allocated the memory the attacker was aiming for —
     *      the check is worthless after the fact. Reading just the header is
     *      what makes this a defense rather than a formality.
     *
     *      Use the reader API rather than ImageIO.read():
     *        try (ImageInputStream in = ImageIO.createImageInputStream(
     *                 new ByteArrayInputStream(originalBytes))) {
     *            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
     *            if (!readers.hasNext()) throw new InvalidMediaException(...);
     *            ImageReader reader = readers.next();
     *            reader.setInput(in);
     *            int w = reader.getWidth(0);
     *            int h = reader.getHeight(0);
     *            ...
     *            reader.dispose();
     *        }
     *      getWidth/getHeight parse only the header, not the pixel data.
     *
     *   2. Decode: BufferedImage image = ImageIO.read(new ByteArrayInputStream(originalBytes));
     *      Treat a null return as invalid input — ImageIO returns null rather
     *      than throwing when no reader can handle the data.
     *
     *   3. Re-encode to a normalized output format and return those bytes:
     *        ByteArrayOutputStream out = new ByteArrayOutputStream();
     *        ImageIO.write(imageToWrite, "jpg", out);   // or "png"
     *
     *      One trap worth thinking about: JPEG cannot represent transparency.
     *      Writing an image that has an alpha channel as JPEG either fails or
     *      produces something ugly. So either normalize everything to PNG, or
     *      pick per-image based on whether the source has alpha
     *      (image.getColorModel().hasAlpha()) — and if you go the JPEG route
     *      for opaque images, draw onto a new BufferedImage of TYPE_INT_RGB
     *      first rather than handing the decoded image straight to the writer.
     *      Your call which way to go; just be deliberate about it.
     *
     *   4. Return a SanitizedImage carrying the new bytes and the mime type you
     *      actually produced — not the type that came in. If you re-encode a
     *      GIF to PNG, the stored type is image/png, and saying otherwise makes
     *      the Content-Type we serve a lie.
     *
     * @throws InvalidMediaException if the image is too large in pixels or
     *                               can't be decoded
     */
    public SanitizedImage sanitizeImage(byte[] originalBytes, String detectedType) {
        // STEP 1 — dimensions BEFORE decoding.
        //
        // This ordering is the whole defense. ImageIO.read() allocates
        // width * height * 4 bytes; by the time it returns, a decompression
        // bomb has already done its damage, so checking afterwards would be
        // pure theatre. getWidth/getHeight parse only the header, so this
        // reads a few dozen bytes rather than the whole pixel grid.
        int width;
        int height;
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(originalBytes))) {
            if (in == null) {
                throw new InvalidMediaException("Could not read image data");
            }

            Iterator<ImageReader> readers = ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                throw new InvalidMediaException("Unsupported or corrupt image");
            }

            ImageReader reader = readers.next();
            try {
                reader.setInput(in);
                width = reader.getWidth(0);
                height = reader.getHeight(0);
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            throw new InvalidMediaException("Could not read image dimensions");
        }

        if (width <= 0 || height <= 0) {
            throw new InvalidMediaException("Image reports invalid dimensions");
        }
        // Multiply as long, not int: 50000 * 50000 overflows an int and comes
        // out NEGATIVE, which would sail straight past a naive check.
        if ((long) width * (long) height > MAX_IMAGE_PIXELS) {
            throw new InvalidMediaException(
                    "Image is too large to process (" + width + "x" + height + ")");
        }

        // STEP 2 — decode. Safe to allocate now that the size is bounded.
        BufferedImage decoded;
        try {
            decoded = ImageIO.read(new ByteArrayInputStream(originalBytes));
        } catch (IOException e) {
            throw new InvalidMediaException("Could not decode image");
        }
        if (decoded == null) {
            // ImageIO signals "no reader could handle this" by returning null
            // rather than throwing, so this is a real failure case, not a
            // paranoid null check.
            throw new InvalidMediaException("Unsupported or corrupt image");
        }

        // STEP 3 — downscale anything larger than we'd ever display. A chat
        // doesn't need a 6000px original, and this is where most of the
        // storage saving comes from: a 12MP phone photo drops to a few
        // hundred KB. It also caps how much memory the re-encode below holds.
        BufferedImage resized = downscaleIfNeeded(decoded);

        // STEP 4 — re-encode.
        //
        // Nothing from the original file survives this. We hand the encoder a
        // pixel grid and it writes a brand-new file: no EXIF (so no GPS
        // coordinates leaking out of someone's camera roll), no trailing
        // appended bytes, no embedded script, no polyglot second-format. Not
        // because we detected and stripped those things — because they were
        // never pixels, and pixels are all that got carried across.
        boolean hasAlpha = resized.getColorModel().hasAlpha();
        String outputFormat = hasAlpha ? "png" : "jpg";
        String outputMimeType = hasAlpha ? "image/png" : "image/jpeg";

        // JPEG has no alpha channel. Handing it an ARGB raster either fails
        // outright or writes garbled colors, so opaque images get redrawn onto
        // a plain RGB canvas first.
        BufferedImage toWrite = resized;
        if (!hasAlpha && resized.getType() != BufferedImage.TYPE_INT_RGB) {
            toWrite = new BufferedImage(resized.getWidth(), resized.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = toWrite.createGraphics();
            try {
                g.drawImage(resized, 0, 0, null);
            } finally {
                g.dispose();
            }
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            if (!ImageIO.write(toWrite, outputFormat, out)) {
                throw new InvalidMediaException("No encoder available for " + outputFormat);
            }
        } catch (IOException e) {
            throw new InvalidMediaException("Could not re-encode image");
        }

        // STEP 5 — report the type we actually PRODUCED, not the one that came
        // in. A GIF re-encoded to PNG is image/png from here on; claiming
        // otherwise would make the Content-Type we serve a lie.
        return new SanitizedImage(out.toByteArray(), outputMimeType);
    }

    /**
     * Scale down so the longest edge is at most MAX_IMAGE_DIMENSION, preserving
     * aspect ratio. Returns the input untouched if it already fits — no point
     * re-sampling (and degrading) an image that's already small enough.
     */
    private BufferedImage downscaleIfNeeded(BufferedImage source) {
        int width = source.getWidth();
        int height = source.getHeight();
        int longestEdge = Math.max(width, height);

        if (longestEdge <= MAX_IMAGE_DIMENSION) {
            return source;
        }

        double scale = (double) MAX_IMAGE_DIMENSION / (double) longestEdge;
        // Never round down to zero on an extremely lopsided image (e.g. 10000x1).
        int targetWidth = Math.max(1, (int) Math.round(width * scale));
        int targetHeight = Math.max(1, (int) Math.round(height * scale));

        BufferedImage target = new BufferedImage(
                targetWidth,
                targetHeight,
                source.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);

        Graphics2D g = target.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.drawImage(source, 0, 0, targetWidth, targetHeight, null);
        } finally {
            g.dispose();
        }

        return target;
    }

    /**
     * Fetch a stored voice note — but only for someone actually entitled to hear it.
     *
     * The object key alone tells you nothing about who's allowed to see it — R2
     * doesn't know your conversations, your app does. So "is this a real key" and
     * "may THIS user have it" both have to be checked here, every single call. A
     * key isn't a permission; it's just a lookup — anyone who came across a key
     * (a leaked log line, a network trace) would otherwise be able to fetch the
     * file directly if we skipped this and just proxied straight to R2.
     *
     * The check: find the message this key belongs to, then confirm the requester
     * is a participant in that message's conversation. If someone who was never
     * in the conversation — or was removed from it later — asks for this key,
     * they get a 403, not the file.
     */
    public DownloadedMedia downloadVoiceNote(String key, String requesterId) {
        Message message = messageRepository.findByAttachment_Key(key)
                .orElseThrow(() -> new NotFoundException("Media not found"));

        Conversation conversation = conversationRepository.findById(message.getConversationId())
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

        if (!conversation.getParticipants().contains(requesterId)) {
            throw new ForbiddenMediaAccessException("You don't have access to this file");
        }

        // Cleared for this user means gone for this user, including by direct
        // key. Filtering the Files list alone would only hide the link — anyone
        // holding a key from before the clear could still pull the bytes.
        java.time.LocalDateTime clearedAt = conversation.getClearedAt().get(requesterId);
        if (clearedAt != null && !message.getCreatedAt().isAfter(clearedAt)) {
            throw new ForbiddenMediaAccessException("You don't have access to this file");
        }

        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();

        ResponseBytes<GetObjectResponse> object = s3Client.getObjectAsBytes(request);
        return new DownloadedMedia(object.asByteArray(), object.response().contentType());
    }

    /**
     * Remove a stored object from R2.
     *
     * Deliberately does NO permission checking, unlike downloadVoiceNote — its
     * only caller is the cleanup job, which has already established that the
     * owning conversation is expired and eligible for deletion. Don't wire this
     * to anything user-facing without adding a participant check first.
     *
     * Idempotent: S3/R2 treat deleting a key that isn't there as success. That's
     * what makes the cleanup job safe to re-run after a partial failure — a
     * second pass over already-deleted blobs is a no-op rather than an error.
     */
    /**
     * Fetch an object's bytes with NO permission check whatsoever.
     *
     * Read that sentence again before calling this. downloadVoiceNote exists
     * precisely because handing out bytes by key alone is not authorisation —
     * a key is a lookup, not a capability, and anything that leaked one (a log
     * line, a network trace) would otherwise be able to pull the file.
     *
     * This raw variant exists for statuses, whose access rule doesn't live
     * here. Whether you may see a status depends on blocking, on the author's
     * hidden-from list, and on expiry — all of which are StatusService's
     * business, and duplicating that decision in this class would create the
     * exact "one rule, several enforcement points" split that caused the
     * cleared-chat leak. So the rule stays in one place and this method is the
     * dumb byte-fetcher underneath it.
     *
     * The only legitimate caller is StatusService, AFTER it has authorised the
     * request. Do not wire this to a controller.
     */
    public DownloadedMedia getObjectBytes(String key) {
        GetObjectRequest request = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();

        ResponseBytes<GetObjectResponse> object = s3Client.getObjectAsBytes(request);
        return new DownloadedMedia(object.asByteArray(), object.response().contentType());
    }

    public void deleteObject(String key) {
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build());
    }
}
