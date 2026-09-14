package com.example.pingBackend.exception;

/**
 * 403 — an action refused because one party has blocked the other.
 *
 * 403 rather than 404: the caller is authenticated and the other person exists,
 * they're simply not permitted. The message is deliberately symmetric ("one of
 * you has blocked the other") — telling someone specifically that THEY were
 * blocked leaks a fact the blocker probably didn't intend to share.
 */
public class BlockedUserException extends ForbiddenException {
    public BlockedUserException(String message) {
        super(message);
    }
}
