package com.example.pingBackend.dto.request;

import lombok.Data;

/**
 * Joining via an invite link. Deliberately empty of anything that matters: the
 * code is in the URL, the joiner is the signed-in user, and nothing the client
 * sends can change the outcome. It exists so the endpoint is a POST with a body
 * rather than a GET, which browsers and crawlers follow on their own.
 */
@Data
public class JoinGroupRequest {
}
