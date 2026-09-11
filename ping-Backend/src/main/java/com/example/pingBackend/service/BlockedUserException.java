package com.example.pingBackend.service;

/**
 * Thrown when an action is refused because one party has blocked the other.
 *
 * Mapped to 403 rather than 404: the caller is authenticated and the resource
 * exists, they're simply not permitted. Note the message is deliberately
 * symmetric ("one of you has blocked the other") — telling someone specifically
 * that THEY were blocked leaks a fact the blocker probably didn't intend to
 * share.
 */
public class BlockedUserException extends RuntimeException {
    public BlockedUserException(String message) {
        super(message);
    }
}
