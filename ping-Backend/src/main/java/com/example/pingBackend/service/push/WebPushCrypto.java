package com.example.pingBackend.service.push;

import io.jsonwebtoken.Jwts;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.time.Instant;
import java.util.Arrays;
import java.util.Date;

/**
 * The two cryptographic halves of Web Push, built from Java's own primitives.
 *
 * 1. MESSAGE ENCRYPTION (RFC 8291). A push travels through Google's, Mozilla's
 *    or Apple's push service on its way to the phone. The payload is
 *    encrypted with keys that only the recipient's browser holds, so those
 *    services carry it without being able to read it.
 *
 * 2. SENDER IDENTIFICATION (RFC 8292, "VAPID"). Each request carries a short
 *    token signed with this server's private key. Push services use it to
 *    know every push to a subscription comes from the same server that
 *    created it, and to contact the operator (the "sub" claim) about abuse.
 *
 * No third-party crypto library: the standard Java library has ECDH,
 * HMAC-SHA-256 and AES-GCM, and jjwt (already used for login tokens) signs
 * the VAPID token. Correctness is pinned by WebPushCryptoTest, which
 * reproduces the worked example published in RFC 8291 byte for byte.
 */
public final class WebPushCrypto {

    /** Records up to 4096 bytes; a push payload is always a single record. */
    private static final int RECORD_SIZE = 4096;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final ECParameterSpec P256 = p256();

    private WebPushCrypto() {
    }

    /** Encrypt a payload for one browser, with a fresh salt and key pair. */
    public static byte[] encrypt(byte[] plaintext, byte[] userAgentPublicKey, byte[] authSecret)
            throws GeneralSecurityException {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(P256);
        return encrypt(plaintext, userAgentPublicKey, authSecret, salt, generator.generateKeyPair());
    }

    /**
     * The actual encryption, with the random parts passed in. Package-private
     * so the test can feed it RFC 8291's published salt and key pair and
     * check the output matches the RFC exactly.
     */
    static byte[] encrypt(byte[] plaintext, byte[] userAgentPublicKey, byte[] authSecret,
                          byte[] salt, KeyPair serverKeys) throws GeneralSecurityException {
        if (plaintext.length + 17 > RECORD_SIZE) {
            throw new GeneralSecurityException("Push payload too large");
        }
        byte[] serverPublic = uncompressed((ECPublicKey) serverKeys.getPublic());

        // Shared secret from our one-time private key and the browser's public key.
        KeyAgreement agreement = KeyAgreement.getInstance("ECDH");
        agreement.init(serverKeys.getPrivate());
        agreement.doPhase(publicKey(userAgentPublicKey), true);
        byte[] ecdhSecret = agreement.generateSecret();

        // Mix in the browser's auth secret, then derive the key and nonce.
        byte[] prkKey = hmac(authSecret, ecdhSecret);
        byte[] ikm = hmac(prkKey, concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII),
                userAgentPublicKey, serverPublic, new byte[]{1}));
        byte[] prk = hmac(salt, ikm);
        byte[] contentKey = Arrays.copyOf(hmac(prk, concat(
                "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), new byte[]{1})), 16);
        byte[] nonce = Arrays.copyOf(hmac(prk, concat(
                "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), new byte[]{1})), 12);

        // One record: the payload plus the 0x02 "last record" delimiter.
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(contentKey, "AES"), new GCMParameterSpec(128, nonce));
        byte[] ciphertext = cipher.doFinal(concat(plaintext, new byte[]{2}));

        // Header: salt, record size, and our one-time public key.
        ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + serverPublic.length);
        header.put(salt).putInt(RECORD_SIZE).put((byte) serverPublic.length).put(serverPublic);
        return concat(header.array(), ciphertext);
    }

    /**
     * The VAPID token for one push service. "aud" must be that service's
     * origin; tokens are short-lived so a leaked one is soon useless.
     */
    public static String vapidToken(ECPrivateKey privateKey, String audience, String subject, Instant expiry) {
        return Jwts.builder()
                .header().add("typ", "JWT").and()
                .audience().single(audience)
                .subject(subject)
                .expiration(Date.from(expiry))
                .signWith(privateKey, Jwts.SIG.ES256)
                .compact();
    }

    // ------------------------------------------------------------------ keys

    /** A P-256 private key from its raw 32-byte scalar (VAPID key format). */
    public static ECPrivateKey privateKey(byte[] scalar) throws GeneralSecurityException {
        return (ECPrivateKey) KeyFactory.getInstance("EC")
                .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, scalar), P256));
    }

    /** A P-256 public key from its 65-byte uncompressed form (0x04 || X || Y). */
    public static ECPublicKey publicKey(byte[] uncompressed) throws GeneralSecurityException {
        if (uncompressed.length != 65 || uncompressed[0] != 4) {
            throw new GeneralSecurityException("Not an uncompressed P-256 public key");
        }
        ECPoint point = new ECPoint(
                new BigInteger(1, Arrays.copyOfRange(uncompressed, 1, 33)),
                new BigInteger(1, Arrays.copyOfRange(uncompressed, 33, 65)));
        return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(point, P256));
    }

    public static byte[] uncompressed(ECPublicKey key) {
        byte[] out = new byte[65];
        out[0] = 4;
        System.arraycopy(fixed32(key.getW().getAffineX()), 0, out, 1, 32);
        System.arraycopy(fixed32(key.getW().getAffineY()), 0, out, 33, 32);
        return out;
    }

    // --------------------------------------------------------------- helpers

    /** BigInteger bytes are signed and variable-length; coordinates are exactly 32. */
    private static byte[] fixed32(BigInteger value) {
        byte[] raw = value.toByteArray();
        byte[] out = new byte[32];
        int length = Math.min(raw.length, 32);
        System.arraycopy(raw, raw.length - length, out, 32 - length, length);
        return out;
    }

    private static byte[] hmac(byte[] key, byte[] data) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) out.writeBytes(part);
        return out.toByteArray();
    }

    private static ECParameterSpec p256() {
        try {
            AlgorithmParameters parameters = AlgorithmParameters.getInstance("EC");
            parameters.init(new ECGenParameterSpec("secp256r1"));
            return parameters.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("P-256 is not available in this JVM", e);
        }
    }
}
