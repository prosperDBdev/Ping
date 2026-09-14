package com.example.pingBackend.exception;

/**
 * 400 — an uploaded file failed validation: too large, the wrong real content
 * type, corrupt. The caller sent something invalid; that's a client error, not a
 * server failure.
 */
public class InvalidMediaException extends BadRequestException {
    public InvalidMediaException(String message) {
        super(message);
    }
}
