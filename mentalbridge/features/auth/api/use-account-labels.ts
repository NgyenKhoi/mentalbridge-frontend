'use client'

import { useEffect, useState } from 'react'

import { browserCommercialReconciliation } from '@/features/reconciliation/api/browser-client'
import { browserConsultation } from '@/features/specialist-profile/api/browser-client'
import { browserAdminAccounts } from './browser-admin-accounts'

type Load = (key: string) => Promise<string | null | undefined>

// One lookup per key for the page session. A failed or empty lookup is dropped
// so a later mount can retry; concurrent callers share the in-flight request.
const lookups = new Map<string, Promise<string | null>>()

function lookup(key: string, load: () => ReturnType<Load>) {
  let pending = lookups.get(key)
  if (!pending) {
    pending = load().then((value) => value || null)
    lookups.set(key, pending)
    pending.then(
      (value) => {
        if (value === null) lookups.delete(key)
      },
      () => lookups.delete(key),
    )
  }
  return pending
}

const specialistName: Load = async (id) =>
  (await browserConsultation.detail(id)).data.displayName

// Identity keeps no names; the email is the only readable label for a client.
const accountEmail: Load = async (id) =>
  (await browserAdminAccounts.detail(id)).data.email

const subscriptionBuyerEmail: Load = async (subscriptionId) => {
  const { userAccountId } =
    await browserCommercialReconciliation.getSubscriptionDetail(subscriptionId)
  return lookup(`USER:${userAccountId}`, () => accountEmail(userAccountId))
}

function useLabels(kind: string, ids: readonly string[], load: Load) {
  const [labels, setLabels] = useState<Record<string, string>>({})
  const signature = [...new Set(ids.filter(Boolean))].sort().join(',')

  useEffect(() => {
    if (!signature) return
    let active = true
    const unique = signature.split(',')
    void Promise.allSettled(
      unique.map((id) => lookup(`${kind}:${id}`, () => load(id))),
    ).then((results) => {
      if (!active) return
      const found = Object.fromEntries(
        results.flatMap((result, index) =>
          result.status === 'fulfilled' && result.value
            ? [[unique[index], result.value] as const]
            : [],
        ),
      )
      if (Object.keys(found).length)
        setLabels((previous) => ({ ...previous, ...found }))
    })
    return () => {
      active = false
    }
  }, [kind, signature, load])

  return labels
}

/** Account id -> readable label: consultation display name for specialists, email otherwise. Unresolved ids are absent. */
export function useAccountLabels(
  ids: readonly string[],
  role: 'SPECIALIST' | 'USER' = 'USER',
) {
  return useLabels(
    role,
    ids,
    role === 'SPECIALIST' ? specialistName : accountEmail,
  )
}

/** Subscription id -> the buyer's email. Unresolved ids are absent. */
export function useSubscriptionBuyerLabels(subscriptionIds: readonly string[]) {
  return useLabels('SUBSCRIPTION', subscriptionIds, subscriptionBuyerEmail)
}
