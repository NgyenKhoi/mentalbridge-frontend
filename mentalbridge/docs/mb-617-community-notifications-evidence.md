# MB-617 Community interaction notification inbox

The Notification Center renders the three Content/Notification-owned Community
kinds with generic supportive copy and follows only the server-derived
`OPEN_COMMUNITY_POST` relative action. The browser validator requires an exact
UUID-backed `/community/{postId}` route, so producer URLs and mismatched targets
cannot become navigation.

The settings view includes an independent `communityInteraction` content-group
switch using the existing accessible switch primitive. The setting remains
under the master notification and in-app channel choices and is persisted with
the same optimistic ETag flow as all other preferences.

The destination Community detail already returns the same user-facing
“Bài viết này không còn khả dụng.” state for hidden, removed, blocked, and
unknown posts. Notification navigation therefore does not reveal whether stale
content exists or why it is unavailable.

Focused component and validation tests cover the new kinds, strict deep link,
read-before-navigation behavior, independent preference update, and rejection
of a mismatched Community target.
