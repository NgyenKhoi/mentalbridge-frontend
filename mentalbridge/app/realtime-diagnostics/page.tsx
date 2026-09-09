import 'server-only'

import './realtime-diagnostics.css'

export const dynamic = 'force-dynamic'

export default function RealtimeDiagnosticsPage() {
  return (
    <main className="realtime-diagnostic-shell">
      <p className="realtime-diagnostic-kicker">Realtime foundation</p>
      <h1>Production connection is fail-closed</h1>
      <p data-testid="production-boundary">
        No approved browser-safe socket credential and Consultation eligibility
        contract are available.
      </p>
    </main>
  )
}
