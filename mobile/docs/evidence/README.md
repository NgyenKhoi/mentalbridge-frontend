# MB-606 review evidence

[`mb-606-welcome.png`](mb-606-welcome.png) is a synthetic, local web render of
the shared Expo/React Native welcome screen at a 390 x 844 mobile viewport. It
contains no account, credential, provider, or production data.

Regenerate it after exporting or starting the Expo web target, then capture the
root route with Playwright at the same viewport. The Android and iOS JavaScript
bundles are verified separately by `npm run quality`; this image is review
evidence for the shared UI only and is not proof of a native device build.
