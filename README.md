# Ping

A real-time messaging platform — private and group chat over WebSocket, with
expiring conversations, 24-hour statuses, and a hardened media pipeline.

Built as a deliberate study of how production software is actually put together,
so the interesting parts of this repository are the decisions rather than the
feature list. Where a choice was non-obvious, the reasoning is in a comment next
to the code that depends on it.

> **This is not open source.** The source is public for review. See [LICENSE](LICENSE).

## Stack

| | |
|---|---|
| Backend | Java 21, Spring Boot, Spring Security (JWT), Spring Data MongoDB, WebSocket/STOMP |
| Frontend | Next.js (App Router), React, TypeScript, Zustand, Tailwind |
| Storage | MongoDB, Cloudflare R2 for media |

## What's built

- **Real-time messaging** — private and group conversations over STOMP/SockJS, with
  read receipts, unread counts, presence, and typing state.
- **Temporary conversations** — mutual invite/accept, an expiry clock, and a
  scheduled job that deletes both the database rows and the stored files.
- **Media pipeline** — voice notes and images. Uploads are type-checked by magic
  bytes rather than by the filename or the declared MIME type, images are
  decoded to pixels and re-encoded so that what gets stored contains nothing but
  pixels, and dimensions are read from the header before decoding to stop
  decompression bombs.
- **Conversation controls** — symmetric, fail-closed blocking enforced at every
  send and create path; per-user history clearing applied in the database query
  rather than after pagination; admin-only member removal.
- **24-hour statuses** — text and image posts with a visibility rule (contacts,
  blocking, per-viewer hiding) that lives in exactly one method, reshares that
  respect the author's preference, and a TTL index behind a cleanup job.

## Running it locally

**Prerequisites:** Java 21, Node 20+, Docker, and a Cloudflare R2 bucket.

```bash
docker run -d --name ping-mongo -p 27017:27017 mongo:7

cd ping-Backend
cp .env.example .env          # fill in JWT_SECRET and the R2 keys
./mvnw spring-boot:run

cd ../ping-frontend
cp .env.example .env.local
npm install && npm run dev
```

The app is at `http://localhost:3000`. The backend refuses to start without
`JWT_SECRET`, on purpose — an authentication system that boots with an empty
signing key is worse than one that doesn't boot at all.

## Tests

```bash
cd ping-Backend && ./mvnw test
```

Covers image sanitization, the symmetry and fail-closed behaviour of blocking,
per-user history visibility, and status visibility.
