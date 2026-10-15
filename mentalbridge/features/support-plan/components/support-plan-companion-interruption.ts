'use client'

import { useSyncExternalStore } from 'react'

const EXTERNAL_DIALOG_SELECTOR =
  '[role="dialog"][aria-modal="true"], dialog[open]'
const COMPANION_DIALOG_SELECTOR = '[data-support-plan-companion-dialog]'

function subscribeExternalDialogs(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-modal', 'open', 'role'],
  })
  return () => observer.disconnect()
}

function hasExternalDialog() {
  return [
    ...document.querySelectorAll<HTMLElement>(EXTERNAL_DIALOG_SELECTOR),
  ].some((dialog) => !dialog.closest(COMPANION_DIALOG_SELECTOR))
}

export function useSupportPlanCompanionInterruption(active = false) {
  const externalDialogActive = useSyncExternalStore(
    subscribeExternalDialogs,
    hasExternalDialog,
    () => false,
  )

  return active || externalDialogActive
}
