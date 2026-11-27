# MB-384 owner-supplied exact call reference

The owner supplied `Pasted text.txt` (attachment 80d66da0-48fa-4a66-b726-e005210f391f)
and explicitly requests visual/interaction fidelity, not a new design. Preserve
the existing User/Specialist global shell. Replace only the dedicated call's
feature header, stage/PiP, local controls, waiting surface and footer/preparation.
The supplied HTML is the approved reference; do not generate a new direction.

Current baseline: real Cloud full-frame screenshots in
`test-results/mb384-livekit-cloud/{user,specialist}-connected{,-375}.png`.
Baseline owning components: VideoConsultationWorkspace, VideoSessionPanel,
VideoMedia and VideoConsultation.module.css. AuthenticatedShell/RoleWorkspace,
global navigation/header, authentication and route authority stay unchanged.
Fetched origin/dev: behind 0; preserve the existing uncommitted MB-384 work.

Slices: (1) render supplied HTML, font/component inspection and interactive
shell-integrated prototype; (2) translate this reference into native components
and scoped CSS, reusing SDK device controls and shared Dialog; (3) targeted
regressions, responsive/accessibility QA, full quality gate once, actual Cloud
journey where feasible. On 2026-10-19 the owner authorized push, PRs into dev and
merge only after successful exact-head CI; no staging deployment is authorized.

Reference: compact white session header, dark full-stage remote feed with vignette,
status/time/quality pills, participant tag, draggable rounded bottom-right PiP
with swap/corner actions, five-button floating control pill, waiting radar,
device settings, cancel-first leave dialog and compact contextual footer.
Use Be Vietnam Pro body and Manrope display as supplied, self-hosted by Next.
No CDN/Tailwind runtime or mock scripts in production. Keep reduced motion,
keyboard alternatives for dragging and minimum accessible targets.

Real fields replace sample names, times, images and quality values. Do not ship
the simulation switcher, pretend ready-ping receipt, E2EE assertions, fake latency/
HD/device capability values, fabricated clinical notes or automatic record-save
alerts. Existing appointment/SDK state drives the matching visual state. Only
the assigned Specialist gets completion, with the existing backend confirmation,
held-credit/pending-evidence semantics and approved brief. Ready/join and device
preview use existing capabilities; no new signaling/business contract is added.

Prototype-only mock interactions and fixture values are design evidence, not an
actual consultation. Validate 1440/1280/768/375/320 and 640x400 in both real shells.

Completed prototype gate: 12 actor/viewport checks, Vietnamese font/glyphs,
PiP bounds, swap/corner and cancel-first leave interactions. Native render gate
also passed 12 actor/viewport checks plus explicit device preview/Stop at
1440/375/320. Scoped contrast rules protect the dark call from global CSS;
extra mobile preview height and footer clearance prevent covered controls.
Only sanitized synthetic native captures are published; the owner attachment
and its reference images remain local, outside the PR.
