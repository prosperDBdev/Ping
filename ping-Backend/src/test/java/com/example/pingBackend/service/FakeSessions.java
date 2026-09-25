package com.example.pingBackend.service;

import com.example.pingBackend.model.User;
import com.example.pingBackend.security.JwtTokenProvider;

import java.util.ArrayList;
import java.util.List;

/**
 * A SessionService that records sign-ins instead of writing to a database,
 * for unit tests of the code that CALLS it. The tokens it hands out are real
 * signed tokens, just tied to made-up session ids.
 */
class FakeSessions extends SessionService {

    static final String SIGNING_KEY = "test-only-signing-key-not-used-anywhere-real-0123456789abcdef";

    final List<String> methods = new ArrayList<>();
    private final JwtTokenProvider jwt;

    FakeSessions() {
        this(new JwtTokenProvider(SIGNING_KEY, 86_400_000));
    }

    private FakeSessions(JwtTokenProvider jwt) {
        super(null, null, jwt, null);
        this.jwt = jwt;
    }

    @Override
    public IssuedSession issueSession(User user, String deviceName, String method) {
        methods.add(method);
        String id = "session-" + methods.size();
        return new IssuedSession(id, jwt.generateToken(user.getUsername(), id));
    }
}
