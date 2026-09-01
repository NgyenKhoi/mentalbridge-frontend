# OpenAPI snapshots

`identity-service-v1.yaml` and `care-service-v1.yaml` are exact, reviewable
snapshots of the canonical backend contracts under
`mentalbridge-backend/contracts/openapi/`. They are committed so frontend
generation and CI do not require network access or credentials for another
repository.

With the backend and frontend repositories checked out as siblings, run:

```powershell
npm run contracts:sync
```

For another checkout layout, set `IDENTITY_OPENAPI_SOURCE` and/or
`CARE_OPENAPI_SOURCE` to paths resolved from this application directory.
Synchronization also regenerates `contracts/identity.generated.ts` and
`contracts/care.generated.ts`.

CI runs `npm run contracts:check`, which validates both OpenAPI documents and
fails when generated types are stale. When either source override is set, the
same command also fails if the backend source and committed snapshot differ.
Never edit a generated TypeScript file by hand.
