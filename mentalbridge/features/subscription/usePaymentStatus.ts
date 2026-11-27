'use client'

import { useEffect, useState } from 'react'
import type { PlanPayment } from '@/lib/consultation/billing-validation'
import { browserSubscription } from './api/browser-client'

const POLL_VISIBLE_MS = 3_000
const POLL_HIDDEN_MS = 15_000
// A payment confirmed just after the client countdown must still be seen.
const GRACE_AFTER_EXPIRY_MS = 60_000

/**
 * Owns the live state of one pending payment: the server is the only source of
 * truth (polled via the payment read, which reconciles with the provider); the
 * countdown is a client clock toward the server expiry. A failed poll never
 * changes the payment, it only marks the connection as retrying.
 */
export function usePaymentStatus(initial: PlanPayment) {
  const [payment, setPayment] = useState(initial)
  // A parent-supplied settled copy of the same payment replaces a stale PENDING; a terminal state never regresses.
  if (
    payment.paymentId === initial.paymentId &&
    payment.status === 'PENDING' &&
    initial.status !== 'PENDING'
  )
    setPayment(initial)
  const [retrying, setRetrying] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const expiry = Date.parse(initial.expiredAt ?? initial.expiresAt)
  const pending = payment.status === 'PENDING'

  useEffect(() => {
    if (!pending || Date.now() >= expiry) return
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [pending, expiry])

  useEffect(() => {
    if (!pending) return
    let active = true
    let inFlight = false
    let failures = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      if (!active || Date.now() > expiry + GRACE_AFTER_EXPIRY_MS) return
      timer = setTimeout(
        () => void poll(),
        document.visibilityState === 'visible'
          ? POLL_VISIBLE_MS
          : POLL_HIDDEN_MS,
      )
    }
    const poll = async () => {
      if (inFlight) return
      inFlight = true
      clearTimeout(timer)
      try {
        const next = await browserSubscription.payment(initial.paymentId)
        if (!active) return
        failures = 0
        setRetrying(false)
        setPayment((previous) =>
          previous.status === next.status &&
          previous.terminalReason === next.terminalReason
            ? previous
            : next,
        )
        if (next.status !== 'PENDING') return
      } catch {
        if (!active) return
        // Two misses in a row: one dropped poll on a flaky link is not worth announcing.
        failures += 1
        if (failures >= 2) setRetrying(true)
      } finally {
        inFlight = false
      }
      setNow(Date.now())
      schedule()
    }
    const wake = () => {
      if (document.visibilityState === 'visible') void poll()
    }
    schedule()
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    return () => {
      active = false
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
    }
  }, [pending, expiry, initial.paymentId])

  const remainingMs = Math.max(0, expiry - now)
  return {
    payment,
    retrying,
    remainingSeconds: Math.ceil(remainingMs / 1_000),
    totalSeconds: Math.max(
      1,
      Math.round((expiry - Date.parse(initial.createdAt)) / 1_000),
    ),
    expired:
      payment.terminalReason === 'EXPIRED' ||
      (payment.status === 'PENDING' && remainingMs === 0),
  }
}
