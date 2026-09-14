package com.example.pingBackend.exception;

import org.springframework.http.HttpStatus;

/**
 * 410 — it existed, but it's over and won't come back: an expired temporary
 * conversation, an invite whose time ran out.
 *
 * More precise than 404, and useful to the frontend: 404 might be a typo worth
 * retrying, 410 means stop trying and tell the user it's ended.
 */
public class GoneException extends ApiException {
    public GoneException(String message) {
        super(HttpStatus.GONE, message);
    }
}
