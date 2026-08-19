# Identity OpenAPI snapshot

`identity-service-v1.yaml` is an exact, reviewable snapshot of the backend
contract at `mentalbridge-backend/contracts/openapi/identity-service-v1.yaml`.
It is committed so frontend generation and CI do not require network access or
credentials for another repository.

With the backend and frontend repositories checked out as siblings, run:

```powershell
npm run contracts:sync
```

For another checkout layout, set `IDENTITY_OPENAPI_SOURCE` to a path resolved
from this application directory. Synchronization also regenerates
`contracts/identity.generated.ts`.

CI runs `npm run contracts:check`, which validates the OpenAPI document and
fails when generated types are stale. When `IDENTITY_OPENAPI_SOURCE` is set, the
same command also fails if the backend source and committed snapshot differ.
Never edit the generated TypeScript file by hand.
