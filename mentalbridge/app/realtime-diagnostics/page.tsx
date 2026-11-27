import 'server-only'

import './realtime-diagnostics.css'

export const dynamic = 'force-dynamic'

export default function RealtimeDiagnosticsPage() {
  return (
    <main className="realtime-diagnostic-shell">
      <p className="realtime-diagnostic-kicker">Realtime foundation</p>
      <h1>Appointment Realtime connection is enabled</h1>
      <p data-testid="production-boundary">
        The browser uses a one-use short-lived socket credential, and every
        subscribe, send, and history operation rechecks Consultation&apos;s
        appointment authority.
      </p>
    </main>
  )
}
