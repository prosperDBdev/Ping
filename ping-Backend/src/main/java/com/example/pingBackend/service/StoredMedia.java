package com.example.pingBackend.service;

/**
 * What {@link MediaStorageService} hands back after a successful upload —
 * the object storage key plus the facts about the file that were actually
 * verified server-side (never trust the client's claimed type/size for
 * anything you're about to persist).
 */
public record StoredMedia(String key, String mimeType, long sizeBytes) {
}
