'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { requestSupportPlanActionCompanionExplanation } from '../api/browser-support-plan'
import { useSupportPlanCompanionInterruption } from '../components/support-plan-companion-interruption'
import type {
  ContextualCompanionRequest,
  ContextualCompanionSnapshot,
} from '../components/support-plan-contextual-companion'

const fallbackMessage =
  'Chưa thể tải lời giải thích lúc này. Bạn vẫn có thể tiếp tục hoạt động hoặc thử lại khi phù hợp.'

/** Companion explanation state moved unchanged from the former native journey. */
export function useCompanion(dirty: boolean) {
  const [snapshot, setSnapshot] = useState<ContextualCompanionSnapshot>()
  const [pending, setPending] = useState(false)
  const sequence = useRef(0)
  const inFlight = useRef(false)
  const interrupted = useSupportPlanCompanionInterruption(dirty)

  const request = useCallback(
    async (next: ContextualCompanionRequest) => {
      if (
        interrupted ||
        inFlight.current ||
        !['TODAY', 'PLAN'].includes(next.surface)
      )
        return
      inFlight.current = true
      setPending(true)
      const requestId = ++sequence.current
      setSnapshot({ ...next, requestId, status: 'loading' })
      try {
        const response = await requestSupportPlanActionCompanionExplanation(
          next.supportPlanId,
          next.actionId,
          next.surface,
        )
        if (sequence.current !== requestId) return
        setSnapshot({
          ...next,
          requestId,
          status: response.delivery === 'TEMPLATE' ? 'fallback' : 'ready',
          message: response.text,
        })
      } catch {
        if (sequence.current !== requestId) return
        setSnapshot({
          ...next,
          requestId,
          status: 'fallback',
          message: fallbackMessage,
        })
      } finally {
        inFlight.current = false
        setPending(false)
      }
    },
    [interrupted],
  )

  const clear = useCallback(() => {
    sequence.current += 1
    setSnapshot(undefined)
  }, [])

  const dismiss = useCallback(() => {
    const targetId = snapshot?.targetId
    clear()
    if (targetId)
      window.requestAnimationFrame(() =>
        document.getElementById(targetId)?.focus(),
      )
  }, [clear, snapshot?.targetId])

  const dismissGuided = useCallback(
    (targetId: string) => {
      if (snapshot?.targetId === targetId) clear()
    },
    [clear, snapshot?.targetId],
  )

  useEffect(() => {
    if (!interrupted || !snapshot) return
    const frame = window.requestAnimationFrame(clear)
    return () => window.cancelAnimationFrame(frame)
  }, [clear, interrupted, snapshot])

  return {
    snapshot,
    pending,
    interrupted,
    request,
    clear,
    dismiss,
    dismissGuided,
  }
}

export type CompanionController = ReturnType<typeof useCompanion>
