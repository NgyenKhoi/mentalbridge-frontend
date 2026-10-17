# MB-614 Community resource attachment evidence

Evidence class: controlled fixture-browser. The identity, Community post and
reviewed resource are synthetic; this is not live cross-stack evidence.

The Community Playwright journey verifies that a USER can select one currently
published MentalBridge resource, create the post, reload its detail route, see
the compact reviewed-resource card, and navigate through the card to the
existing `/resources/{resourceId}` experience. The fixture also exercises the
same Community and Content BFF routes used by the application.

Owner/component coverage verifies replacement and removal during post editing,
legacy posts without the optional field, strict `{resourceId}` response shape,
unavailable resources without dead links, and that neither resource body nor
version labels are rendered by Community.

Regenerate after a production build:

```text
npm run build
npx playwright test tests/e2e/community-feed.spec.ts --workers=1
```

The synthetic screenshot is
[`mb-614-community-resource-attachment.png`](mb-614-community-resource-attachment.png).
