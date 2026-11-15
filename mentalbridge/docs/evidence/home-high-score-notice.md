# Home high-score notice — owner decision, 2026-11-08

The owner selected a separate dashboard notification for completed screening
results at the severe level: PHQ-9 20–27 or GAD-7 15–21. The notification is
labelled “Nên tìm hỗ trợ chuyên môn”, not an imminent-danger classification.

`HomeScreeningNotice` reads the existing combined-meaning API for the exact
completed episode referenced by Home. It checks the evaluation and episode
identities before using the original instrument score and authoritative
`SEVERE` band. It never adds the two scores. No completed episode means no
request or notice; a failed read has a neutral local retry and a result link.
The rest of Home remains usable while this independent read is pending.

The Home `REVIEW_SAFETY_SUPPORT` card is a quiet navigation shortcut rather
than the high-score warning. Item-9 safety scoring, Care next-action decisions,
stored results, result-page safety guidance and the safety directory are
unchanged. Existing no-interrupt behaviour remains for a safety next action.

Boundary examples authored in `HomeScreeningNotice.test.tsx`: PHQ-9 19 versus
20; GAD-7 14 versus 15; incomplete episode; low-score positive safety evidence;
wrong episode and retry. The Home component and browser fixtures are updated
for the new read and quiet shortcut. Tests are not executed, following the
owner's no-test preference. Verification uses targeted lint, non-emitting
TypeScript, formatting and the frontend production build.
