# MB-720 mobile password flows UX brief

## Authority and scope

- Mobile reuses the existing Identity contracts only: recovery request, reset
  with a challenge, and authenticated password change. There is no client-side
  OTP verification step.
- Recovery acknowledgement is deliberately identical for every syntactically
  valid email so the UI never reveals whether an account exists.
- A reset challenge remains in component memory only, is removed from the
  visible Expo route immediately, and is never logged or persisted.
- A successful reset returns to sign-in without creating a session. A
  successful authenticated change clears the already-revoked local session and
  also returns to sign-in.

## Locked shell and Stitch references

- Public baseline: `mobile/docs/evidence/mb-606-welcome.png` and the existing
  `Screen`/`authStyles` implementation. Keep the full-frame safe-area reading
  column; do not add a toolbar, carousel, logo block, sidebar, or bottom nav.
- Authenticated baseline: the existing profile route and back control. Password
  change is a profile security destination, not a new application shell.
- Stitch project: `projects/10509806209320093143` using design system
  `assets/8a18e52ae11e456889c382c58acd21d0`.
- Recovery reference:
  `projects/10509806209320093143/screens/1e86b360201e4d50bdf85a870c014c2e`.
- Reset reference:
  `projects/10509806209320093143/screens/44471930f078480e88a9ab6eb1eb2b9a`.
- Authenticated change reference:
  `projects/10509806209320093143/screens/1582146f4ae448b8980a01043dc9e7e7`.
- Screenshot and HTML resources were downloaded and inspected. Their form
  hierarchy, persistent labels, inline status treatment, 48px actions, and
  teal/cream palette are retained. Preview-only state tabs, invented headers,
  status indicators, brand marks, icons, and HIPAA claims are rejected.

## Interaction decisions

- Sign-in exposes a clear `Quên mật khẩu?` link. Recovery validates email shape
  locally, then waits for the server before showing the generic acknowledgement.
- Reset and change forms show three kinds of feedback without false success:
  field validation, actionable contract errors, and retryable dependency errors.
- New passwords must contain 12–128 Unicode code points, occupy no more than 72
  UTF-8 bytes, and match confirmation. Current password is required and capped
  at 128 code points.
- Reset success replaces the form with a completion state and a deliberate
  sign-in action. Change success clears local credentials/session only after the
  server confirms success; protected routing then exposes sign-in.
- Every control has a visible label and at least a 48px target. Runtime status is
  announced with the appropriate accessibility role/live region.

## Verification boundary

- Component tests cover generic acknowledgement, invalid/consumed challenge,
  client validation, pending controls, retry, API paths, and session clearing.
- Maestro source is authored for the public recovery route. Device execution is
  recorded as `NOT_RUN` until the MB-666 staging/device gate is available.
