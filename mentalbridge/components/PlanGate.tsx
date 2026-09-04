'use client'

import Link from 'next/link'

export type PlanId = 'free' | 'plus' | 'premium'

const PLAN_RANK: Record<PlanId, number> = { free: 0, plus: 1, premium: 2 }
const PLAN_LABEL: Record<PlanId, string> = {
  free: 'Miễn phí',
  plus: 'Plus',
  premium: 'Premium',
}

type PlanGateProps = {
  children: React.ReactNode
  currentPlan?: PlanId
  required: Exclude<PlanId, 'free'>
  title: string
  description?: string
}

/** Preview a premium surface while making the upgrade requirement explicit. */
export default function PlanGate({
  children,
  currentPlan = 'free',
  required,
  title,
  description = 'Nâng cấp để mở đầy đủ tính năng này.',
}: PlanGateProps) {
  const unlocked = PLAN_RANK[currentPlan] >= PLAN_RANK[required]
  if (unlocked) return <>{children}</>

  return (
    <div className="plan-gate" data-required-plan={required}>
      <div className="plan-gate-preview" aria-hidden="true">
        {children}
      </div>
      <div className="plan-gate-overlay">
        <span className={`plan-gate-badge ${required}`}>
          {PLAN_LABEL[required]}
        </span>
        <strong>{title}</strong>
        <p>{description}</p>
        <Link href="/subscription" className="plan-gate-action">
          Nâng cấp {PLAN_LABEL[required]} <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )
}
