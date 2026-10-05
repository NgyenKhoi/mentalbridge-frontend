# MB-607 mobile Identity session evidence

MB-607 keeps Identity as the only authority for registration, verification,
login, refresh, logout, account status, subject, and role. Mobile consumes the
frozen `identity-service-v1.yaml` contract without changing backend semantics.

## Contract mapping

| Mobile behavior     | Identity endpoint                               | Mobile decision                                                                 |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Register USER       | `POST /api/v1/auth/registrations`               | Sends the fixed `USER` actor type and an idempotency key.                       |
| Verify email        | `POST /api/v1/auth/email-verifications`         | Consumes the existing one-time `challenge` query value.                         |
| Resend verification | `POST /api/v1/auth/email-verification-requests` | Preserves the contract's non-enumerating accepted response.                     |
| Login               | `POST /api/v1/auth/login`                       | Persists the returned token pair only through SecureStore.                      |
| Resolve actor       | `GET /api/v1/account`                           | Opens the USER shell only for an active, verified USER response.                |
| Refresh             | `POST /api/v1/auth/refresh`                     | Rotates both credentials with an idempotency key before rechecking the account. |
| Logout              | `POST /api/v1/auth/logout`                      | Attempts server revocation and always clears local credentials.                 |

The app never decodes a JWT to grant access. A missing, partial, expired,
revoked, replayed, non-USER, inactive, or unverified session fails closed.
Dependency failures remain distinguishable: personal routes stay closed while
stored credentials are retained for an explicit retry.

## Credential and restart behavior

SecureStore holds access/refresh credentials and both expiry instants in four
separate protected slots. A partial write is treated as no session. The provider
restores and verifies the session at startup, refreshes one minute before access
expiry, and does not render protected navigation while restoration or a
dependency retry is pending.

## Verification links

Expo Router handles the committed `mentalbridge` scheme. A development-build
verification link is:

```text
mentalbridge:///verify-email?challenge=<one-time-challenge>
```

The screen copies the existing path/query semantics, consumes the challenge,
and immediately removes it from navigation state. Production HTTPS links need
the separately approved Android App Link and iOS Universal Link association for
the web domain; this story does not change Identity's email-link URL.

## Automated evidence

The mobile Jest suite covers login success and invalid credentials, account
authority, app-restart restoration, refresh rotation, access and refresh expiry,
revocation/replay, dependency unavailability, logout cleanup, fixed USER
registration, verification deep links, secure storage, and exact REST paths and
idempotency headers. The repository mobile quality workflow additionally runs
formatting, lint, strict TypeScript, Jest, Android/iOS bundle export, and native
Android/iOS boot smoke jobs.
