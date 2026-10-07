import type { ReactNode } from 'react'

export type SupportPlanIconName =
  | 'arrow_forward'
  | 'arrow_right_alt'
  | 'auto_mode'
  | 'calendar_month'
  | 'calendar_today'
  | 'calendar_view_week'
  | 'call'
  | 'chat'
  | 'check'
  | 'check_circle'
  | 'chevron_left'
  | 'chevron_right'
  | 'edit_note'
  | 'health_and_safety'
  | 'history'
  | 'info'
  | 'lock'
  | 'menu_book'
  | 'pause_circle'
  | 'play_circle'
  | 'psychology'
  | 'remove'
  | 'self_improvement'
  | 'sentiment_satisfied'
  | 'settings_suggest'
  | 'share'
  | 'show_chart'
  | 'star'
  | 'verified_user'
  | 'view_agenda'

const iconPaths: Record<SupportPlanIconName, ReactNode> = {
  arrow_forward: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  arrow_right_alt: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  auto_mode: (
    <>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M6.1 9a7 7 0 0 1 11.5-2.6L20 12" />
      <path d="M17.9 15a7 7 0 0 1-11.5 2.6L4 12" />
    </>
  ),
  calendar_month: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  calendar_today: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  calendar_view_week: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18M9 10v11M15 10v11" />
    </>
  ),
  call: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c1 .3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" />
  ),
  chat: (
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
  ),
  check: <path d="m5 12 4 4L19 6" />,
  check_circle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.7 2.7L16.5 9" />
    </>
  ),
  chevron_left: <path d="m15 18-6-6 6-6" />,
  chevron_right: <path d="m9 18 6-6-6-6" />,
  edit_note: (
    <>
      <path d="M4 6h10M4 10h8M4 14h6" />
      <path d="m14 17 5-5 2 2-5 5-3 1Z" />
    </>
  ),
  health_and_safety: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.7 7.5 9.5 4.4-1.8 7.5-4.9 7.5-9.5V6Z" />
      <path d="M12 8v7M8.5 11.5h7" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  menu_book: (
    <>
      <path d="M3 5.5A3.5 3.5 0 0 1 6.5 2H11v17H6.5A3.5 3.5 0 0 0 3 22Z" />
      <path d="M21 5.5A3.5 3.5 0 0 0 17.5 2H13v17h4.5A3.5 3.5 0 0 1 21 22Z" />
    </>
  ),
  pause_circle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  play_circle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4Z" />
    </>
  ),
  psychology: (
    <>
      <path d="M9.5 4.5A3.5 3.5 0 0 0 6 8v.3A3.5 3.5 0 0 0 4 14a3.5 3.5 0 0 0 4 3.5V20" />
      <path d="M14.5 4.5A3.5 3.5 0 0 1 18 8v.3a3.5 3.5 0 0 1 2 5.7 3.5 3.5 0 0 1-4 3.5V20M12 4v16M8 9h4M12 14h4" />
    </>
  ),
  remove: <path d="M5 12h14" />,
  self_improvement: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M5 21c1-4 3-6 7-6s6 2 7 6M8 10l4 5 4-5M4 17l4-2M20 17l-4-2" />
    </>
  ),
  sentiment_satisfied: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 10h.01M16 10h.01M8 14c1 1.5 2.3 2 4 2s3-.5 4-2" />
    </>
  ),
  settings_suggest: (
    <>
      <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="13" cy="18" r="2" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" />
    </>
  ),
  show_chart: <path d="m4 17 5-5 4 3 7-8M15 7h5v5" />,
  star: (
    <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
  ),
  verified_user: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.7 7.5 9.5 4.4-1.8 7.5-4.9 7.5-9.5V6Z" />
      <path d="m8.5 12 2.2 2.2 4.8-4.8" />
    </>
  ),
  view_agenda: (
    <>
      <rect x="4" y="4" width="16" height="6" rx="1" />
      <rect x="4" y="14" width="16" height="6" rx="1" />
    </>
  ),
}

type Props = Readonly<{
  name: SupportPlanIconName
  size?: number
  className?: string
}>

export default function SupportPlanIcon({ name, size = 18, className }: Props) {
  return (
    <svg
      aria-hidden="true"
      className={['support-plan-icon', className].filter(Boolean).join(' ')}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name]}
    </svg>
  )
}
