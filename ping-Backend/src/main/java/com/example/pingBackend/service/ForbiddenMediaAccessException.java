package com.example.pingBackend.service;

/**
 * Thrown when an authenticated user asks for a real, existing piece of media
 * that they're not a participant in the conversation for. Mapped to a 403 in
 * MediaController — this is the "verify identity on the way OUT" half of the
 * access-control lesson; uploadVoiceNote() was the "verify content on the way
 * IN" half.
 */
public class ForbiddenMediaAccessException extends RuntimeException {
    public ForbiddenMediaAccessException(String message) {
        super(message);
    }
}
