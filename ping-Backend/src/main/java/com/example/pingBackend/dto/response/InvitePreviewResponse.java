package com.example.pingBackend.dto.response;

/**
 * What a stranger holding an invite link is told: who invited them.
 *
 * A username and nothing else — no user id, no email, no avatar. This comes
 * from a public endpoint that anyone can call without an account, so every
 * extra field would be handed to anyone who has, finds or guesses a link.
 */
public record InvitePreviewResponse(String inviterUsername) {
}
