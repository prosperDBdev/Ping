package com.example.pingBackend.service;

import com.example.pingBackend.exception.BadRequestException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Stage 13: the parts of emailed codes that don't need a database. */
class LoginCodeRulesTest {

    private final LoginCodeService codes =
            new LoginCodeService(null, null, new RateLimiter(), "server-secret-for-tests-0123456789abcdef");

    @Test
    @DisplayName("codes are always exactly six digits, leading zeros included")
    void sixDigits() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 2_000; i++) {
            String code = LoginCodeService.newCode();
            assertTrue(code.matches("\\d{6}"), code);
            seen.add(code);
        }
        assertTrue(seen.size() > 1_900, "codes should practically never repeat in a small sample");
    }

    @Test
    @DisplayName("the stored hash depends on the challenge, the code and the server key")
    void hashIsBound() {
        String a = codes.codeHash("challenge-a", "123456");
        assertEquals(a, codes.codeHash("challenge-a", "123456"));
        assertNotEquals(a, codes.codeHash("challenge-b", "123456"), "same code, different sign-in");
        assertNotEquals(a, codes.codeHash("challenge-a", "123457"));

        LoginCodeService otherServer =
                new LoginCodeService(null, null, new RateLimiter(), "a-different-server-secret-0123456789abcd");
        assertNotEquals(a, otherServer.codeHash("challenge-a", "123456"),
                "without the server's key, a copy of the database can't be checked against guesses");
    }

    @Test
    @DisplayName("anything but six digits is refused before any database work or counted attempt")
    void formatIsCheckedFirst() {
        for (String bad : new String[]{null, "", "12345", "1234567", "12a456", "{\"$gt\":\"\"}"}) {
            assertThrows(BadRequestException.class,
                    () -> codes.verify("challenge", bad, LoginCodeService.Purpose.LOGIN), String.valueOf(bad));
        }
    }

    @Test
    @DisplayName("the email hint shows enough to recognise, not to learn, an address")
    void emailHint() {
        assertEquals("m•••@gmail.com", LoginCodeService.emailHint("maya.jones@gmail.com"));
        assertEquals("your email", LoginCodeService.emailHint("no-at-sign"));
        assertEquals("your email", LoginCodeService.emailHint(null));
    }
}
