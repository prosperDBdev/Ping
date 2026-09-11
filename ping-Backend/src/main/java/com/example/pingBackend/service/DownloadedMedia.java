package com.example.pingBackend.service;

/** What downloadVoiceNote() hands back — the file's bytes plus its real content type. */
public record DownloadedMedia(byte[] bytes, String contentType) {
}
