'use client'

import { Dialog } from './Dialog'
import styles from './ConfirmDialog.module.css'

export type ConfirmDialogRequest = Readonly<{
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'warning'
}>

type ConfirmDialogProps = Readonly<{
  request: ConfirmDialogRequest | null
  onResolve: (confirmed: boolean) => void
}>

export function ConfirmDialog({ request, onResolve }: ConfirmDialogProps) {
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onResolve(false)
      }}
      labelledBy="global-confirm-title"
      describedBy="global-confirm-description"
    >
      {request && (
        <div className={styles.content} data-tone={request.tone ?? 'danger'}>
          <span className={styles.icon} aria-hidden="true">
            !
          </span>
          <h2 id="global-confirm-title">{request.title}</h2>
          <p id="global-confirm-description">{request.description}</p>
          <div className={styles.actions}>
            <button type="button" onClick={() => onResolve(false)} autoFocus>
              {request.cancelLabel ?? 'Quay lại'}
            </button>
            <button type="button" onClick={() => onResolve(true)}>
              {request.confirmLabel ?? 'Xác nhận'}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
