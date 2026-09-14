package com.example.pingBackend.exception;

import org.springframework.http.HttpStatus;

/**
 * 404 — there's nothing here, as far as this caller is concerned.
 *
 * "As far as this caller is concerned" is doing real work. It's also the right
 * answer when the thing exists but belongs to someone else. If a conversation you
 * aren't in returned 403 while a made-up id returned 404, anyone could try ids and
 * learn which conversations are real just from which error came back. Returning
 * 404 for both means the error says nothing about data you can't see. (GitHub
 * does exactly this for private repositories.)
 */
public class NotFoundException extends ApiException {
    public NotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }
}
