# MB-642 controlled production-browser evidence

These selected screenshots come from the post-sync production standalone build,
not raw Stitch screens or the supplemental interaction prototype. The existing
source shell, four plan tabs and canonical Journal editor are retained.

From `mentalbridge/` on Windows, with installed Chrome:

```powershell
$env:PLAYWRIGHT_BROWSER_CHANNEL = 'chrome'
Remove-Item Env:PLAYWRIGHT_BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:E2E_RUNTIME -ErrorAction SilentlyContinue
npx playwright test tests/e2e/support-plan-journal-action.spec.ts tests/e2e/support-plan-emotion-action.spec.ts --workers=1 --reporter=line
```

Result: exit 0, 2/2 tests passed. The test-owned production server and synthetic
Identity/Care providers use loopback ports 3100/3201/3202. No shared account,
database, credential, paid provider, native app or private native Stitch play is
verified by this result. Synthetic journal writing is not personal user content.

The Journal journey asserts stable create retries after an uncertain response,
dirty Escape/Back/Stay and pending Back protection, the owner-returned entry ID,
exact return/focus, explicit completion checks and outage retry, and unchanged
accepted history after revision/deletion. It also checks loaded brand fonts,
no horizontal overflow and an unobscured Save hit target at five viewports.
Desktop/mobile primary states and representative saved/source-outage states are
included here. Full raw Playwright output stays outside Git.

The complete post-sync web `npm run quality` also passed: 235 suites / 1,326
tests, format/lint/typecheck/contracts and production build. See the
[story checkpoint](../../../docs/mb-642-journal-plan-action.md) for backend,
mobile and Docker evidence limits.
