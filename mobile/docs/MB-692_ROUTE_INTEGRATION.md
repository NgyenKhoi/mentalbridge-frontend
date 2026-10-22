# MB-692 — Sequential Community chat entry integration

This narrow integration follows [feature PR #216](https://github.com/NgyenKhoi/mentalbridge-frontend/pull/216)
and its [acceptance-state/handoff document](MB-692_COMMUNITY_CHAT.md). It is kept
separate per the Story's shared-navigation annotation. Owner: Thảo Nguyên;
integrator review of the single new app-route export remains required.

The existing USER stack retains its shell, header and navigation. One route
re-exports the feature. Community adds an inbox entry and an optional available
author handoff: anonymous/deleted authors and owner-authored posts never become
chat targets. UUID validation happens before navigation, then the feature uses
current Community authorization. No Home, appointment route, provider, theme,
dependency or configuration change is included.

The Notification consumer accepts the current canonical closed enums, including
non-chat producers, so a mixed inbox remains valid. Three exact action/href/UUID
descriptors map to conversation/request/invitation params. Unsupported specialist
and Support Guide actions remain safely unavailable on this USER consumer.
Arbitrary hrefs, suffixes, actor params and mismatched target IDs never reach
the router. Content's fresh mark-read action supplies navigation; the feature
then resolves a target against current owner/recipient data. A request/invitation
link cannot open a different list item or grant history access.

Backend MB-749 #215 merged as `cd71159d`; feature #216 squash-merged into frontend
`dev` as `060c361`. The integration is now rebased onto frontend `dev` at
`3fbc020`, including MB-621 / #209. PR #217 targets `dev` with the intended
11-file diff. The rebase preserved the reviewed mobile source tree; this
document updates the delivery state.
Required CI must pass on the final head before integrator approval and merge.

Verification in this worktree: non-emitting TypeScript and focused formatting;
lint for all ten touched source/test/route files; 151 tests across 15 suites
covering Community chat, MB-628 Community and Notifications, repeated after the
rebase. React `act` warnings remain in asynchronously notified component tests;
all assertions passed. The five new Community entry/author cases were also run
alone with a clean console before the rebase. No unrelated test refactor is
included.

New integration cases cover available/anonymous/deleted/owner author controls,
the closed route, all three notification link kinds and malformed descriptors,
current canonical kind parsing, and fresh notification mark-read navigation.
Existing appointment and resource notification mappings remain covered.

[Feature component screenshots](MB-692_COMMUNITY_CHAT.md#design-and-screenshots)
and the verified Android baseline describe the preserved native composition.
Actual Android/deep-link/keyboard/foreground execution and Docker acceptance
remain the MB-666/post-merge gates. Maestro source is in #216. This integration
does not claim `ui-ready` or Story Done.
