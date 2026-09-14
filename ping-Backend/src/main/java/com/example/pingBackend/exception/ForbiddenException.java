package com.example.pingBackend.exception;

import org.springframework.http.HttpStatus;

/**
 * 403 — "we know exactly who you are, and you still can't do this": a non-admin
 * removing a group member, messaging someone who blocked you.
 *
 * Not the same as 401, which means "we don't know who you are" (sign in again).
 *
 * Use it only when revealing that the thing EXISTS is fine. If even confirming it
 * exists would leak something — someone else's conversation, say — throw
 * NotFoundException instead, so "not yours" and "not real" look identical.
 */
public class ForbiddenException extends ApiException {
    public ForbiddenException(String message) {
        super(HttpStatus.FORBIDDEN, message);
    }
}
