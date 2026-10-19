# MB-594 specialist notification center evidence

The Specialist Portal notification destination now consumes the authenticated shared inbox BFF instead of a deferred placeholder. It renders authoritative loading, empty, error, unread, pagination, read, mark-all-read, delete, and safe deep-link states without seeded activity or unread badges.

The settings view intentionally exposes only the specialist operational groups for appointment/message and account/system updates. Its PATCH payload cannot include Journal, emotion, streak, screening, Community, wellbeing-digest, or resource-reminder controls. The backend independently enforces the same boundary.

Notification actions are accepted only through the generated OpenAPI enum and exact relative-route validation. Appointment actions resolve to `/specialist/appointments`; deleted or unavailable targets retain the destination's existing safe unavailable behavior.
