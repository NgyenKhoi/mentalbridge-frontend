# MB-652 adaptive review Companion brief

## Product boundary

- Route: `/support-plan`, USER role, Adjust tab with the existing bounded Companion panel open.
- Job: help the user understand Care's authoritative adaptive review facts and admitted choices before deciding in the normal Adjust UI.
- Care remains authoritative for the replacement-review outcome, evidence dimensions, admitted current/proposed plans, and mutations.
- Companion never calculates an overall wellbeing, recovery, adherence, or treatment score; never diagnoses; never invents evidence; and never applies or confirms a change.
- No raw assessment answers, Journal text, Emotion detail, consultation content, provider/model metadata, or internal service terminology is shown.

## Existing full-frame baselines

- Desktop Stitch screen: `e872da32752e44a58286e443f1eb3f68` in project `1256373820415012052`.
- Mobile Stitch screen: `01398a785ec541f79d100fd89718a6ec` in the same project.
- Both screens were generated for MB-653 and retain the current shell, SupportPlan route hierarchy, Companion visual language, desktop in-flow panel, and mobile sheet behavior.

## Generated MB-652 references

- Desktop Stitch screen: `9e45f9025c194ce095b4df9bc1ace155`.
- Mobile Stitch screen: `2299f01ccfa84537988822c3e088fcad`.
- Exported interaction prototypes: `desktop.html` and `mobile.html`; the generated markup is design evidence only and is not copied into production.

## Locked and editable regions

- Locked: application sidebar/mobile navigation, route header, Today/Plan/Progress/Adjust tabs, main Adjust content, Companion identity/header/close control, page width, and scroll ownership.
- Editable: only the response body inside the already-open Companion panel/sheet after the user selects “Vì sao lần xem lại này gợi ý thay đổi?”.
- Conditional: the existing Adjust navigation action may remain, but it must not become a plan mutation control.

## Review state

Use one synthetic contradictory, alternative-available example:

- screening: PHQ-9 decreased while GAD-7 increased; preserve both separately;
- Journal context: insufficient/unavailable, described without exposing raw text;
- plan engagement: repeated `NOT_ENOUGH_TIME` and one consistently helpful activity;
- explicit self-report: “khó khăn hơn”;
- Care outcome: current plan remains admissible and an admitted alternative is available;
- options: keep current plan or review the admitted alternative. Scheduling/professional-support options are shown only when Care exposes them; do not invent them for this screen.

The response should use compact titled sections such as “Điều MentalBridge đã ghi nhận”, one row/card per evidence dimension, “Các tín hiệu chưa hoàn toàn cùng chiều”, and “Bạn có thể chọn”. Include a calm boundary note that final confirmation happens in Adjust and the current plan remains unchanged until then.

## States and behavior

- Available contradictory review: show separate dimensions and explicitly acknowledge disagreement.
- Sparse/unavailable dimension: show a factual unavailable/insufficient message, never fill the gap.
- Unchanged review: keep-current-plan is the primary available outcome.
- Alternative available: compare only the current and admitted proposed plan facts supplied by Care.
- Current plan not admissible: explain Care's outcome without presenting AI as the decision-maker; confirmation remains outside Companion.
- Companion failure: the authoritative Adjust review remains visible and usable.
- Keyboard, 44px touch targets, Vietnamese diacritics, 375px no-overflow, and reduced-motion/static equivalence are required.

## Implementation mapping

- `SupportPlanCompanionPanel.tsx`: render the bounded review explanation.
- `support-plan-review-companion.ts`: pure mapping from `NativeSupportPlanReplacementReview` to user-facing sections/options.
- `SupportPlanWorkspace.tsx`: pass the current authoritative review to the panel and keep existing mutation handlers unchanged.
- Existing MB-653 interruption, mute, session retention, modal focus, and request-lock behavior remains unchanged.
