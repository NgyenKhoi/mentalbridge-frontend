'use client'

import { WorkspaceMessage } from '@/features/support-plan/workspace/WorkspaceStates'
import '@/features/support-plan/workspace/support-plan-workspace.css'

/** Route-level fallback: a render failure shows one calm step instead of a blank page. */
export default function SupportPlanError({
  reset,
}: Readonly<{ reset: () => void }>) {
  return (
    <div className="mbw-page">
      <header className="mbw-header">
        <h1>Kế hoạch của bạn</h1>
      </header>
      <WorkspaceMessage
        alert
        title="Chưa hiển thị được kế hoạch"
        primary={{ label: 'Thử lại', onClick: reset }}
      >
        <p>Kế hoạch của bạn không bị thay đổi. Hãy thử lại sau giây lát.</p>
      </WorkspaceMessage>
    </div>
  )
}
