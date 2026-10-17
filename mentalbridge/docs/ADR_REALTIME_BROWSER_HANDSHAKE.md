# ADR: browser Realtime authentication boundary

- Status: **accepted and implemented for appointment chat (MB-382)**
- Scope: frontend Realtime transport, schema version 1
- Date: 2026-09-29

## Context

The frontend owns an HttpOnly Identity session. A general Identity bearer must
not be exposed to browser JavaScript, URLs, public environment variables,
storage, diagnostics, or logs, while Socket.IO still needs a browser-safe
handshake credential.

## Decision

The browser requests a one-use socket credential through the authenticated,
same-origin BFF route `POST /api/realtime/socket-credentials`. The BFF forwards
the server-owned Identity bearer to Realtime. Realtime returns a random 256-bit
ticket with at most a 30-second lifetime.

Realtime stores only a SHA-256-derived Redis key. Its short-lived record binds
the account, role, Identity token ID and Identity expiry; the bearer body is
AES-256-GCM encrypted at rest. Socket authentication atomically consumes the
record with `GETDEL`, so replay fails. The connected server process retains the
decrypted bearer only in socket memory and disconnects at the original Identity
expiry.

Each initial connection and bounded reconnect obtains a fresh ticket. The
browser does not persist the ticket. The exchange rejects cross-origin requests.
The BFF returns the configured public Realtime endpoint with the ticket; that
endpoint is not a secret, and Realtime still enforces its strict origin
allowlist. A deployment may expose it directly or route it through same-origin
ingress.

## Appointment authorization

The browser never decides appointment access from its local clock. It obtains
Consultation's decision through the BFF and Realtime repeats the same
authoritative check for subscribe, send and history operations. Dependency
failure denies the operation. Sending is allowed only in `[startsAt, endsAt)`;
the ten-minute pre-start window is subscribe-only. Ended, cancelled and
rescheduled appointments expose history as read-only.

## Consequences

- A stolen ticket has a bounded lifetime and cannot be replayed after use.
- Session revocation blocks new exchanges; active socket revocation remains
  bounded by the Identity expiry unless a later revocation signal is added.
- Reconnect includes history resynchronization and message-ID deduplication.
- No `NEXT_PUBLIC_` secret or reusable bearer is introduced.
