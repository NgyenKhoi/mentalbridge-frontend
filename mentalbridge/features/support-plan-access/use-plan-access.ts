'use client'

import { useCallback, useEffect, useState } from 'react'
import { browserServiceCredits } from '@/features/service-credits/api/browser-client'
import { browserSubscription } from '@/features/subscription/api/browser-client'
import { planAccessFrom, type PlanAccessStatus } from './plan-access'

export type PlanAccess = Readonly<{
  status: PlanAccessStatus
  /** A checkout awaits confirmation; it grants nothing until Consultation confirms it. */
  pendingPayment: boolean
}>

async function readAccess(): Promise<PlanAccess> {
  const [account, history] = await Promise.all([
    browserServiceCredits.get().catch(() => null),
    // Only decides between "upgrade" and "check status"; the checkout page re-reads it.
    browserSubscription.history().catch(() => null),
  ])
  return {
    status: planAccessFrom(account),
    pendingPayment:
      history?.items.some((item) => item.status === 'PENDING') ?? false,
  }
}

export function usePlanAccess() {
  const [access, setAccess] = useState<PlanAccess>({
    status: 'loading',
    pendingPayment: false,
  })

  useEffect(() => {
    let active = true
    void readAccess().then((value) => {
      if (active) setAccess(value)
    })
    return () => {
      active = false
    }
  }, [])

  const retry = useCallback(async () => {
    setAccess({ status: 'loading', pendingPayment: false })
    setAccess(await readAccess())
  }, [])

  return { access, retry }
}
