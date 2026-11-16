# MB-697 admin AI benchmark evidence

## Acceptance state matrix

| State             | Expected admin surface                                               |
| ----------------- | -------------------------------------------------------------------- |
| Loading           | Existing privileged data is not inferred as current.                 |
| Empty             | Catalogue and run history show explicit empty copy.                  |
| Dataset selected  | Exact dataset version and SHA-256 provenance are visible before run. |
| Archived          | Audit history remains visible; new run action is disabled.           |
| Provider failure  | Operation fails closed and no successful result is claimed.          |
| 401/403 on reload | Retained dataset, selection and run history are cleared.             |
| Export            | Only aggregate metrics and pinned provenance are downloaded.         |

Automated component and BFF route tests cover the authorization, selection,
archive/run boundaries and fail-closed refresh behavior. This ADMIN web story
does not require Android Studio or native evidence. Authenticated full-frame
route capture remains `NOT_RUN` in the local implementation environment.
