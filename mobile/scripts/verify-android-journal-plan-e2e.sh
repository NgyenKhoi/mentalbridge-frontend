#!/usr/bin/env bash
set -euo pipefail

# Author-only MB-642 runner. Native execution/evidence remains gated by MB-666.
# This runner never provisions or resets accounts/databases and never points to
# the shared local Docker app. The maintainer must approve a disposable fixture.
if [[ "${MAESTRO_MB642_DISPOSABLE_FIXTURE:-}" != "true" || "${PROVIDER_EVIDENCE:-}" != "protected-controlled-real-contract" ]]; then
  echo 'MB-642 requires the approved protected disposable real-contract harness.' >&2
  exit 1
fi
: "${EXPO_PUBLIC_API_BASE_URL:?An approved isolated API edge is required}"
: "${MAESTRO_MB_SUPPORT_PLAN_USER_EMAIL:?Dedicated synthetic USER is required}"
: "${MAESTRO_MB_SUPPORT_PLAN_USER_PASSWORD:?Protected fixture credential is required}"
case "$EXPO_PUBLIC_API_BASE_URL" in
  http://127.0.0.1:*|http://10.0.2.2:*) ;;
  *) echo 'MB-642 author-only runner accepts only an isolated loopback/emulator edge.' >&2; exit 1 ;;
esac
command -v maestro >/dev/null
# Maestro receives environment variables by inheritance. Detailed reports may
# contain synthetic writing or login fields, so keep them outside artifact trees.
report_dir="$(mktemp -d)"
if ! maestro test --debug-output "$report_dir" .maestro/mb-642-journal-plan.yaml; then
  echo 'MB-642 native journey failed. Private detailed reports were not retained as release evidence.' >&2
  exit 1
fi
