package com.example.pingBackend.service.push;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.time.Instant;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

/**
 * Web Push encryption checked against RFC 8291's own worked example.
 *
 * Encryption bugs don't crash: they produce bytes the phone silently fails to
 * decrypt, and the notification just never appears. So instead of testing that
 * our code agrees with itself, this feeds in the exact keys, salt and message
 * from RFC 8291 section 5 and requires the exact output printed there. Any
 * mistake in the key derivation, the nonce, the padding delimiter or the header
 * layout changes the output and fails the test.
 */
class WebPushCryptoTest {

    private static byte[] b64(String s) {
        return Base64.getUrlDecoder().decode(s);
    }

    private static String b64(byte[] b) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    @Test
    @DisplayName("reproduces the RFC 8291 section 5 example exactly")
    void rfc8291Example() throws Exception {
        byte[] plaintext = "When I grow up, I want to be a watermelon".getBytes(StandardCharsets.UTF_8);
        KeyPair serverKeys = new KeyPair(
                WebPushCrypto.publicKey(b64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8")),
                WebPushCrypto.privateKey(b64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw")));
        byte[] userAgentPublic = b64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
        byte[] authSecret = b64("BTBZMqHH6r4Tts7J_aSIgg");
        byte[] salt = b64("DGv6ra1nlYgDCS1FRnbzlw");

        byte[] body = WebPushCrypto.encrypt(plaintext, userAgentPublic, authSecret, salt, serverKeys);

        assertEquals(
                "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
                b64(body));
    }

    @Test
    @DisplayName("every real encryption uses a fresh salt and key, so the same message never looks the same")
    void freshRandomnessEachTime() throws Exception {
        byte[] userAgentPublic = b64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
        byte[] auth = b64("BTBZMqHH6r4Tts7J_aSIgg");
        byte[] message = "hello".getBytes(StandardCharsets.UTF_8);
        assertNotEquals(b64(WebPushCrypto.encrypt(message, userAgentPublic, auth)),
                b64(WebPushCrypto.encrypt(message, userAgentPublic, auth)));
    }

    @Test
    @DisplayName("the VAPID token verifies with the public key and names the push service")
    void vapidToken() throws Exception {
        KeyPair keys = new KeyPair(
                WebPushCrypto.publicKey(b64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8")),
                WebPushCrypto.privateKey(b64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw")));
        String token = WebPushCrypto.vapidToken(
                (java.security.interfaces.ECPrivateKey) keys.getPrivate(),
                "https://fcm.googleapis.com", "mailto:security@ebitimi.dev", Instant.now().plusSeconds(3600));

        Claims claims = Jwts.parser().verifyWith(keys.getPublic()).build().parseSignedClaims(token).getPayload();
        assertEquals("https://fcm.googleapis.com", claims.getAudience().iterator().next());
        assertEquals("mailto:security@ebitimi.dev", claims.getSubject());
    }
}
