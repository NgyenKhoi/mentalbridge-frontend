'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { ActionToast } from './ActionToast'
import { ConfirmDialog, type ConfirmDialogRequest } from './ConfirmDialog'
import { NotificationToast } from './NotificationToast'
import type { ToastInput, ToastItem } from './toast-types'

type FeedbackContextValue = Readonly<{
  showActionToast: (toast: ToastInput) => string
  showNotificationToast: (toast: ToastInput) => string
  dismissToast: (id: string) => void
  confirm: (request: ConfirmDialogRequest) => Promise<boolean>
}>

const fallbackFeedback: FeedbackContextValue = {
  showActionToast: () => '',
  showNotificationToast: () => '',
  dismissToast: () => undefined,
  confirm: async () => true,
}

const FeedbackContext = createContext<FeedbackContextValue>(fallbackFeedback)

let toastSequence = 0

function nextToastId() {
  toastSequence += 1
  return `mb-toast-${toastSequence}`
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [actionToasts, setActionToasts] = useState<ToastItem[]>([])
  const [notificationToasts, setNotificationToasts] = useState<ToastItem[]>([])
  const [confirmRequest, setConfirmRequest] =
    useState<ConfirmDialogRequest | null>(null)
  const timers = useRef(new Map<string, number>())
  const confirmResolver = useRef<((confirmed: boolean) => void) | null>(null)

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer !== undefined) window.clearTimeout(timer)
    timers.current.delete(id)
    setActionToasts((current) => current.filter((item) => item.id !== id))
    setNotificationToasts((current) => current.filter((item) => item.id !== id))
  }, [])

  const enqueue = useCallback(
    (placement: 'action' | 'notification', input: ToastInput) => {
      const item: ToastItem = {
        ...input,
        id: nextToastId(),
        tone: input.tone ?? 'success',
        duration: input.duration ?? (input.tone === 'error' ? 6500 : 4500),
      }
      const update =
        placement === 'action' ? setActionToasts : setNotificationToasts
      update((current) => [...current, item].slice(-3))
      timers.current.set(
        item.id,
        window.setTimeout(() => dismissToast(item.id), item.duration),
      )
      return item.id
    },
    [dismissToast],
  )

  const resolveConfirm = useCallback((confirmed: boolean) => {
    confirmResolver.current?.(confirmed)
    confirmResolver.current = null
    setConfirmRequest(null)
  }, [])

  const confirm = useCallback((request: ConfirmDialogRequest) => {
    confirmResolver.current?.(false)
    setConfirmRequest(request)
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve
    })
  }, [])

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer)
      confirmResolver.current?.(false)
    },
    [],
  )

  const value = useMemo<FeedbackContextValue>(
    () => ({
      showActionToast: (toast) => enqueue('action', toast),
      showNotificationToast: (toast) => enqueue('notification', toast),
      dismissToast,
      confirm,
    }),
    [confirm, dismissToast, enqueue],
  )

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ActionToast items={actionToasts} onDismiss={dismissToast} />
      <NotificationToast items={notificationToasts} onDismiss={dismissToast} />
      <ConfirmDialog request={confirmRequest} onResolve={resolveConfirm} />
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  return useContext(FeedbackContext)
}
