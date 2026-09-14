package com.example.pingBackend.exception;

import org.springframework.http.HttpStatus;

/**
 * 400 — the request itself doesn't make sense: missing text, an invalid value,
 * trying to block yourself. The caller can fix it by sending something else.
 */
public class BadRequestException extends ApiException {
    public BadRequestException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }
}
