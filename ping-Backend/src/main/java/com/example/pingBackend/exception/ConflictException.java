package com.example.pingBackend.exception;

import org.springframework.http.HttpStatus;

/**
 * 409 — the request is fine on its own, but clashes with what already exists:
 * a username someone already has, an invite that's already been answered.
 */
public class ConflictException extends ApiException {
    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, message);
    }
}
