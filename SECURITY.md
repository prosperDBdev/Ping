# Security Policy

Ping is a real-time messaging app: a Next.js frontend, a Spring Boot API with
WebSocket/STOMP messaging, and MongoDB, deployed with Docker behind nginx.

This document is for security researchers and penetration testers. It covers how
to report a problem, what may be tested and how, the controls already in place,
and the limitations that are already known.

*Last reviewed: 24 September 2026.*

---

## Reporting a vulnerability

**Email:** `<security contact address, to be filled in by the owner>`

Please **do not** open a public issue for a security problem. Include:

- what you found and where (URL, endpoint, parameter)
- steps to reproduce, and the impact you believe it has
- any error ID shown in the response (8 characters). It lets the owner find the
  matching server-side log entry.

You can expect an acknowledgement within 7 days. This is a one-person project, so
fixes are prioritised by impact rather than by a fixed timeline.

---

## Scope for authorised testing

**Testing is permitted only with written authorisation from the owner** that names
the tester, the dates, and this scope. Without it, testing is not permitted.

### In scope

| Target | Notes |
|---|---|
| `https://ping.ebitimi.dev` | the web app, the API under `/api/`, the WebSocket endpoint under `/ws` |
| `155.133.27.51` | the host itself, ports 22, 80 and 443 only |
| This repository | white-box review of the source is welcome |

### Out of scope

- **Denial of service** of any kind: load testing, flooding, resource exhaustion
- **Third-party services**: Cloudflare R2, Brevo, Contabo's infrastructure and
  control panel, Namecheap, GitHub. They belong to other companies, and this
  authorisation does not extend to them.
- Social engineering, phishing, or physical attacks
- Any account not issued to you for the test

### Rules of engagement

1. Use only the test accounts the owner issues. At least two are provided, so
   that one user reaching another's data can be tested.
2. **If you reach another user's data or any credential, stop and report it**
   rather than exploring further. Don't copy, keep or share it.
3. Don't modify or delete data you didn't create, and don't leave persistence,
   backdoors or new accounts on the host.
4. **Some endpoints send real email.** Password reset and feedback go out through
   Brevo on a small daily quota. Use them sparingly, and only with the issued
   test accounts' addresses.
5. Rate limiting is enabled, so being temporarily locked out is expected
   behaviour rather than a finding.

---

## Owner checklist

**Before a test**

- [ ] Take a Contabo snapshot of the server, so it can be restored afterwards
- [ ] Create the test accounts and send them to the tester
- [ ] Sign and send the written authorisation: tester, dates, this scope
- [ ] Confirm the logs are being kept: `docker compose logs` for the apps, and
      `/var/log/nginx/ping.access.log` and `ping.error.log`

**After a test**

- [ ] Rotate every secret in the server's `.env`, and assume the tester saw anything they could reach:
  - `JWT_SECRET` (this signs everyone out)
  - the MongoDB password. `MONGO_INITDB_*` only applies to an empty database, so
    change it inside Mongo with `db.changeUserPassword()` *and* update `.env`.
  - the R2 access keys, in the Cloudflare dashboard
  - the Brevo API key, in the Brevo dashboard
- [ ] Delete the test accounts
- [ ] Review the logs against the tester's report
- [ ] Restore from the snapshot if anything is in doubt

---

## Architecture and trust boundaries

```
Browser --HTTPS--> nginx (only public entry point; TLS ends here)
                     |-- /       -> Next.js      127.0.0.1:3000
                     |-- /api/   -> Spring Boot  127.0.0.1:8080
                     `-- /ws     -> Spring Boot  127.0.0.1:8080  (SockJS / STOMP)
                                        |
                                        |--> MongoDB        Docker network only, no published port
                                        |--> Cloudflare R2  private bucket for uploaded media
                                        `--> Brevo          outbound transactional email
```

- The browser holds a JWT and sends it as a `Bearer` header on API calls, and in
  the STOMP `CONNECT` frame for the WebSocket.
- **R2 is never reached directly by browsers.** Every media download goes through
  an authenticated API endpoint that checks the caller may see that object.

---

## Security controls in place

### Authentication and sessions

- JWT (HS256) with a 24-hour expiry. The signing secret comes only from the
  environment, and the app refuses to start without one.
- Tokens issued before the user's last password change are rejected, so a
  password reset signs every device out.
- Passwords are hashed with BCrypt.
- Login failures return the same message for an unknown user as for a wrong
  password. A dummy hash is checked for unknown users, so response timing
  doesn't reveal which usernames exist either.

### Rate limiting (sliding window)

| Action | Limit |
|---|---|
| Login | 5 failures per IP per account, and 50 per IP across all accounts, per 15 min |
| Password reset request | 10 per IP and 3 per email address, per hour |
| Password reset confirmation | 10 per IP per 15 min |
| Feedback | 5 per user per hour |

Behind nginx the real client IP comes from `X-Forwarded-For`. It's trusted only
when the connection comes from an internal proxy address, so a client can't
forge a new IP per request.

### Password reset

- Reset links expire after 15 minutes.
- The response is the same whether or not the email has an account, and the email
  is sent in the background so timing doesn't reveal it either.

### Authorisation

- **Identity always comes from the verified token.** No endpoint accepts a user
  ID telling it whose data to change. Profile-photo writes exist only as
  `/api/users/me/...`.
- Only a conversation's participants can reach it. A non-participant gets the
  same `404` as for a conversation that doesn't exist.
- **WebSocket:** the token is verified on `CONNECT`. `SUBSCRIBE` is allow-listed
  to the user's own topic and to conversations they belong to, and wildcard
  destinations are rejected. Someone removed from a group loses their live
  subscription immediately rather than on reconnect.
- Blocking works in both directions for messaging, and blocked users are
  excluded from search.
- Statuses honour the author's contacts, their "hide from" list, and their reshare
  permission.

### File uploads

- 10 MB maximum, enforced by nginx and again by Spring.
- **The type is decided from the file's bytes** (Apache Tika), never from the
  filename or the client's `Content-Type`.
- **Images** are allow-listed to JPEG, PNG and WebP. SVG and GIF are refused.
  Dimensions are checked from the header *before* decoding (a 40-megapixel cap,
  against decompression bombs). Every image is then decoded and **re-encoded**,
  so EXIF (including GPS location), trailing data and polyglot payloads don't
  survive.
- Voice notes are allow-listed to audio types.
- Storage keys are generated by the server. Client filenames are never used in
  storage paths.
- Downloads are served with `X-Content-Type-Options: nosniff`, and only
  known-safe types render inline. Anything else is forced to download.

### Errors

- Clients get short, generic messages. Unexpected errors return an 8-character
  error ID, and the full stack trace is logged server-side against that ID only.
- Validation errors name the field that failed but never internal class names or
  types.

### Email

- User-supplied text in feedback emails is HTML-escaped.
- Emails never contain passwords, tokens, or message contents.

### Infrastructure

- SSH accepts keys only. Password login is disabled, and root can log in only
  with a key.
- The ufw firewall allows 22, 80 and 443 only.
- MongoDB has no published port. Both apps listen on `127.0.0.1`, so nginx is the
  only thing reachable from outside. (The loopback binding also matters because
  Docker's own firewall rules would otherwise bypass ufw.)
- Secrets exist only in the server's `.env` (mode 600), never in git. A pre-commit
  hook in `.githooks/` blocks commits containing env files or credential-shaped
  text.
- `.dev` is on the browsers' HSTS preload list, so browsers use HTTPS only.

---

## Known limitations

These are already known. Please don't report them as new findings, but do tell the
owner if you find a way one of them is worse than described.

1. **Any user can read any other user's email address.** `GET /api/users/search`
   and `GET /api/users/{id}` include `email` in their responses, so a signed-in
   user can collect addresses by searching. *This is the highest priority to fix.*
2. **The JWT is stored in `localStorage`,** so any XSS would expose it. No
   Content-Security-Policy is set yet to limit the impact of one.
3. **No security headers yet:** no CSP, `X-Frame-Options`/`frame-ancestors`,
   `Referrer-Policy` or `Permissions-Policy`. Clickjacking is therefore possible.
4. **There's no server-side logout.** A token stays valid until it expires (24
   hours) unless the user changes their password. A single stolen token can't be
   revoked on its own.
5. **Registration reveals whether a username or email is taken** (a 409 response),
   and **registration and search aren't rate limited,** so both allow account
   enumeration, and registration allows bulk sign-ups.
6. **Rate limits and online presence are held in memory,** per server instance.
   They reset on restart, and IP-based limits scale with how many IPs an attacker
   controls.
7. **Voice notes are type-checked but not re-encoded,** unlike images.
8. **Profile photos can be read by any signed-in user.** This is intentional,
   because avatars appear in search results and member lists.
9. **The application connects to MongoDB as its root user** rather than a
   least-privilege account.
10. No multi-factor authentication.
11. `GET /api/memories` isn't implemented and returns a generic 500 with an error ID.
