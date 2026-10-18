# Lịch hẹn: popup thao tác

- Reference: full-frame screenshot attached by the user, 1374 × 1856 after chat resize. The current `AuthenticatedShell` owns the sidebar and top bar; `AppointmentRequestPanel` owns only the appointment content.
- Actor and job: the signed-in user reviews an appointment, requests a new time, reads available notes or a completed session record, rates a completed appointment, and chooses a real available slot without losing the list context.
- Locked: global sidebar, top bar, route title, navigation, chat/video destinations, and emergency phone action.
- Editable: appointment list actions, spotlight change action, quick-booking action, and their dialogs.
- Authority: the existing consultation browser client supplies appointments and available slots. No placeholder appointment, availability, entitlement or clinical assertion may authorize an action.
- States: loading, empty, error with retry, available selection, submitting, confirmed request, and stale appointment. Native dialog behavior restores focus; Escape and backdrop close only when no command is in flight.
- Desktop: a compact centered dialog with schedule and relevant actions, max-height scrolling within the dialog. Mobile: the same content fits the viewport with readable controls and no horizontal overflow. Reduced motion removes entry animation.
- The `mentalbridge-stitch-ui` Stitch generation gate could not run because this session has no Stitch tool or browser surface. The user explicitly approved the attached screenshot plus repository `Dialog` as the fallback. `prototype.html` exercises that direction before application code.
