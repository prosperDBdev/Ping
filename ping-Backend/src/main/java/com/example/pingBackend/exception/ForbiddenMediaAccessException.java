package com.example.pingBackend.exception;

/**
 * 403 — an authenticated user asked for media, or a status, they aren't allowed
 * to see. The "verify identity on the way OUT" half of access control; validating
 * uploads is the "verify content on the way IN" half.
 */
public class ForbiddenMediaAccessException extends ForbiddenException {
    public ForbiddenMediaAccessException(String message) {
        super(message);
    }
}
