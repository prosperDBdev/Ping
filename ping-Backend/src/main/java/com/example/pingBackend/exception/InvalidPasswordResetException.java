package com.example.pingBackend.exception;

/**
 * 400 — a bad reset link. One exception for every way a link can be bad (never
 * existed, expired, already used), so the response can't be used to tell those
 * cases apart.
 */
public class InvalidPasswordResetException extends BadRequestException {
    public InvalidPasswordResetException(String message) {
        super(message);
    }
}
