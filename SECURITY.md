# Security Policy

Ping is a real-time messaging app: a Next.js frontend, a Spring Boot API with
WebSocket/STOMP messaging, and MongoDB, deployed with Docker behind nginx.

This document is for security researchers and penetration testers. It covers how
to report a problem, what may be tested and how, the controls already in place,
and the limitations that are already known.

*Last reviewed: 25 September 2026 (Stages 13 and 14).*

---

## Reporting a vulnerability

**Email:** `security@ebitimi.dev`

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
  - the VAPID key pair, if the tester could have read it. Note that new keys
    silently unsubscribe every device, so everyone has to allow notifications
    again.
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
- **Every token belongs to a server-side session** (one per signed-in device,
  in the `sessions` collection), named in the token's `sid` claim. A token
  is accepted only while its session exists, and the user is taken from the
  session rather than from the token's subject. Tokens without a session are
  refused.
- **Signing out is real.** "Log out" deletes the session on the server. Users
  can see every signed-in device (Settings → Linked devices) and sign any of
  them out. Signing a device out also closes its open WebSocket connections
  immediately, so it stops receiving messages at once, not at its next
  reconnect.
- Tokens issued before the user's last password change are rejected, and a
  password reset deletes every session, so it signs every device out.
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
| Invite link preview (public) | 30 per IP per 10 min |
| New invite link | 10 per user per hour |
| Emailed sign-in codes | 6 per user per hour; 3 emails per code, 30 s apart |
| Entering a sign-in code | 5 wrong guesses per code; 30 per IP per 15 min |
| Turning two-step verification off (password check) | 5 per user per 15 min |
| QR sign-in codes | 30 per IP per 10 min |
| QR approval and lookup | 30 per user per 10 min |

Behind nginx the real client IP comes from `X-Forwarded-For`. It's trusted only
when the connection comes from an internal proxy address, so a client can't
forge a new IP per request.

### Two-step verification (optional)

- When a user turns it on, a correct password returns **no token**: only a
  challenge (256 random bits) and a masked email address. A 6-digit code is
  emailed, and a session is created only when it is entered.
- Codes come from `SecureRandom`, expire after 10 minutes, and are single use
  (removed atomically on success). The attempt is counted atomically *before*
  the code is compared, and the code is destroyed after 5 wrong guesses.
  Comparison is constant-time.
- Codes are stored as an HMAC keyed with a secret derived from the server's
  signing key and bound to their challenge, so a copy of the database can't be
  brute-forced offline. Challenges are stored as SHA-256 hashes.
- At most 3 emails per challenge, 30 seconds apart, and 6 challenges per user
  per hour, so knowing someone's password can't be used to flood their inbox.
- Turning it on requires entering an emailed code first (proving the inbox
  works). Turning it off requires the password.

### QR sign-in

- A computer opens a plain WebSocket at `/ws-pair` (origin-checked, 30 per
  IP per 10 minutes, at most 1,000 waiting codes) and receives a code of 256
  random bits, valid for 2 minutes and single use. The QR code is a link with
  the code after `#`, which browsers never send to a server, and the phone
  sends it back in a request body, never a URL, so it doesn't reach logs.
- Only a signed-in user can look up or approve a code. Approval creates a
  session for the approver, named after the computer, and delivers its token
  down that computer's socket. Nothing the computer sends is trusted.
- **QRLjacking** (being tricked into scanning an attacker's code) is mitigated
  by the approval screen, which names the device asking and warns plainly not
  to approve a code someone sent you. It can't be prevented technically.

### Password reset

- Reset links expire after 15 minutes.
- The response is the same whether or not the email has an account, and the email
  is sent in the background so timing doesn't reveal it either.

### Invite links

- Each user has at most one live invite link (unique index), valid for 7 days.
  Codes are 128 random bits from `SecureRandom`, encoded as 22 URL-safe
  characters.
- Making a new link overwrites the old code in a single atomic upsert, so the
  previous link stops working immediately.
- The public preview (`GET /api/auth/invites/{code}`) returns only the inviter's
  username, and the same `404` whether a code is unknown, expired, replaced or
  malformed. Malformed codes are rejected before any database query.
- Expiry is enforced on every lookup; the TTL index only cleans up afterwards.
- An invalid code never blocks registration: the account is created without
  attribution. Who invited a user is recorded server-side and never returned in
  any user profile.

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
- **Email addresses are private.** A user's email is returned only on their own
  profile (`GET /api/users/me`) and at their own login or registration. Search
  results, other users' profiles, the blocked list and conversation participant
  lists omit it entirely.
- **Reactions** accept only the five emoji the app offers, one per person
  (stored per user, so concurrent reactions can't overwrite each other).
- **Edits** are allowed only to the sender, only for text messages, and only
  within 10 minutes of sending by the server's clock. All three conditions are
  part of the database update itself, so there is no check-then-act gap.
- **Delete for everyone** is allowed only to the sender, within 48 hours of
  sending by the server's clock, and those conditions are part of the database
  update. It clears the text, attachment, reactions and status quote (the
  stored file is removed too), leaving a "deleted" marker. A deleted message
  can't be edited or reacted to.
- **Delete for me** hides a message from the caller only, and is filtered in
  the history query itself. Who has hidden what is never returned by the API.
- **Tasks** are visible to a conversation's participants only; personal
  reminders only to their creator (to anyone else they return 404 and are
  never broadcast on the conversation topic). Assignees must be participants.
  Only a task's creator or the group admin can delete it. Reminder sends are
  claimed atomically, so each goes out once.
- **Deleting a chat** from your chat list is per user and participants only:
  it hides the conversation from your list and clears it for you, in one
  atomic update of your own fields. Nothing is deleted, and the other
  participant's list and history are untouched.
- For all of these, the message must belong to the conversation named in the URL
  (no reaching another chat's message by id), the usual participant and
  blocking rules apply, and updates are never sent to anyone's inbox channel.
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

### Push notifications (Web Push)

- **SSRF protection:** a device's push address is accepted only if it's HTTPS,
  on the default port, has no embedded credentials, and its host is a real push
  service (Google FCM, Mozilla, Apple, Windows). Internal addresses, IPs,
  lookalike domains and `user@host` tricks are refused. The HTTP client never
  follows redirects, so an allowed address can't bounce a request elsewhere.
- Payloads are encrypted for the recipient's browser (RFC 8291), so the push
  services carrying them can't read them. Requests are signed with this
  server's VAPID key (RFC 8292). The implementation is tested against the RFC's
  published example.
- Push addresses act as keys to a device: they are never returned by the API
  or written to logs. A device can only be registered to, or removed by, the
  signed-in user; signing out removes it.
- At most 10 devices per user. Devices the push service reports as gone
  (404/410) are deleted.

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

1. **The JWT is stored in `localStorage`,** so any XSS would expose it. No
   Content-Security-Policy is set yet to limit the impact of one.
2. **No security headers yet:** no CSP, `X-Frame-Options`/`frame-ancestors`,
   `Referrer-Policy` or `Permissions-Policy`. Clickjacking is therefore possible.
3. **Pending QR sign-in codes live in server memory,** like the rate limits:
   a restart discards them (the computer simply shows a new code), and they
   assume a single server instance.
4. **Registration reveals whether a username or email is taken** (a 409 response),
   and **registration and search aren't rate limited,** so both allow account
   enumeration, and registration allows bulk sign-ups.
5. **Rate limits and online presence are held in memory,** per server instance.
   They reset on restart, and IP-based limits scale with how many IPs an attacker
   controls.
6. **Voice notes are type-checked but not re-encoded,** unlike images.
7. **Profile photos can be read by any signed-in user.** This is intentional,
   because avatars appear in search results and member lists.
8. **The application connects to MongoDB as its root user** rather than a
   least-privilege account.
9. **Two-step verification is optional, off by default, and email-based.** It
   is only as strong as the user's email account, and there are no backup
   codes: losing access to the inbox means a password reset (which also uses
   email).
10. `GET /api/memories` isn't implemented and returns a generic 500 with an error ID.
11. **Requests refused by Spring Security's firewall** (for example, URLs with an
    encoded `/`) get the servlet container's default HTML error page rather than
    the standard JSON error. It shows no version number or stack trace, but its
    styling identifies the server software.
12. **Reply quotes can be forged.** A reply is stored as a JSON header on the
    first line of the message text, and the server never checks it. Anyone can
    send a message whose first line is a fake quote attributed to another user.
    The fix is a server-verified reference to the original message.
13. **Messages are not end-to-end encrypted.** They are encrypted in transit
    (HTTPS/WSS) but stored readable on the server, so anyone with access to the
    server or the database can read them.
14. **"Delete for everyone" can't recall copies that already left the server:**
    a push notification already shown on someone's phone, or a screenshot.
    The same is true of every messaging app.
