'use client'

import Link from 'next/link'
import { useId, type ReactNode } from 'react'
import { LifeBuoy } from 'lucide-react'

export function WorkspaceLoading({ label }: Readonly<{ label: string }>) {
  return (
    <div className="mbw-tile mbw-next" aria-busy="true">
      <p className="mbw-quiet" role="status">
        {label}
      </p>
      <span className="mbw-skeleton mbw-skeleton-title" />
      <span className="mbw-skeleton mbw-skeleton-line" />
      <span className="mbw-skeleton mbw-skeleton-line is-short" />
    </div>
  )
}

type Action =
  | Readonly<{ label: string; href: string }>
  | Readonly<{ label: string; onClick: () => void; busy?: boolean }>

function ActionControl({
  action,
  primary,
}: Readonly<{ action: Action; primary: boolean }>) {
  const className = primary ? 'mbw-primary' : 'mbw-secondary'
  return 'href' in action ? (
    <Link className={className} href={action.href}>
      {action.label}
    </Link>
  ) : (
    <button
      type="button"
      className={className}
      disabled={action.busy}
      onClick={action.onClick}
    >
      {action.label}
    </button>
  )
}

/** One state, one main step: what happened, then how to continue. */
export function WorkspaceMessage({
  title,
  children,
  primary,
  secondary,
  tone = 'calm',
  alert = false,
}: Readonly<{
  title: string
  children: ReactNode
  primary?: Action
  secondary?: Action
  tone?: 'calm' | 'safety'
  alert?: boolean
}>) {
  const titleId = useId()
  return (
    <section
      className={`mbw-tile mbw-state${tone === 'safety' ? ' is-safety' : ''}`}
      aria-labelledby={titleId}
      role={alert ? 'alert' : undefined}
    >
      {tone === 'safety' && (
        <LifeBuoy className="mbw-next-icon" aria-hidden="true" />
      )}
      <h2 id={titleId}>{title}</h2>
      <div className="mbw-state-body">{children}</div>
      {(primary || secondary) && (
        <div className="mbw-actions">
          {primary && <ActionControl action={primary} primary />}
          {secondary && <ActionControl action={secondary} primary={false} />}
        </div>
      )}
    </section>
  )
}
