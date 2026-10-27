import AuthenticatedShell from '@/components/AuthenticatedShell'
import { resolveWorkspaces } from '@/features/auth/model/workspace'
import { MamDockSlot } from '@/features/mam/MamDockSlot'
import { requireCurrentAccount } from '@/lib/auth/dal'

import './dashboard.css'
import './subscription/subscription.css'
import './dashboard-shell.css'

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const account = await requireCurrentAccount(['USER'])

  return (
    <AuthenticatedShell workspaces={resolveWorkspaces(account.roles) ?? []}>
      {children}
      {process.env.MAM_WEB_ENABLED === 'true' ? (
        <MamDockSlot accountId={account.accountId} />
      ) : null}
    </AuthenticatedShell>
  )
}
