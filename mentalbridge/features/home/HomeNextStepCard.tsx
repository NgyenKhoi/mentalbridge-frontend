'use client'

import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Check,
  ClipboardCheck,
  HeartHandshake,
  Leaf,
  MessageCircle,
  NotebookPen,
  Phone,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { CRISIS_SUPPORT_CONTENT } from '@/components/crisis-support/crisis-support-content'
import type { HomeNextStep } from '@/features/assessment/api/care-contract'
import { useMamTarget } from '@/features/mam/use-mam-target'
import type { PublicResourceSummary } from '@/features/resources/api/browser-resources'
import { homeNextStepView } from './home-next-step-state'
import {
  homeIllustration,
  homeJourneyTrail,
  homeResourceTypeLabel,
} from './home-presentation'

const actionPresentation = {
  RESOURCE: { label: 'Tài nguyên', Icon: BookOpen },
  JOURNAL: { label: 'Nhật ký', Icon: NotebookPen },
  EMOTION_CHECK_IN: { label: 'Cảm xúc', Icon: HeartHandshake },
  ROUTINE_SELF_MANAGEMENT: { label: 'Chăm sóc bản thân', Icon: Leaf },
  PROFESSIONAL_SUPPORT: { label: 'Hỗ trợ từ chuyên gia', Icon: MessageCircle },
  REASSESSMENT_SCREENING: { label: 'Kiểm tra lại', Icon: ClipboardCheck },
  SELF_REPORT_REVIEW: { label: 'Nhìn lại cảm nhận', Icon: ClipboardCheck },
} as const

function Illustration({
  home,
  resourceCategory,
}: Readonly<{
  home: HomeNextStep
  resourceCategory?: PublicResourceSummary['category']
}>) {
  const kind = homeIllustration(home, resourceCategory)
  if (!kind) return null
  return (
    <div
      className={`home-art${kind === 'done' ? ' home-symbol' : ''}`}
      aria-hidden="true"
      data-home-art={kind}
    >
      <svg
        width="76"
        height="76"
        viewBox="0 0 76 76"
        fill="none"
        stroke="var(--teal)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === 'breath' ? (
          <>
            <circle
              className="home-ring"
              cx="38"
              cy="38"
              r="34"
              stroke="var(--teal-pale)"
            />
            <circle
              className="home-ring"
              cx="38"
              cy="38"
              r="24"
              stroke="var(--teal)"
              opacity=".5"
            />
            <circle
              className="home-ring"
              cx="38"
              cy="38"
              r="14"
              fill="var(--teal)"
              stroke="none"
            />
          </>
        ) : kind === 'journal' ? (
          <>
            <rect
              x="18"
              y="12"
              width="36"
              height="50"
              rx="4"
              fill="var(--surface-soft)"
            />
            <path d="M26 25h20M26 34h13M26 43h8m10 13 3-10 15-15 7 7-15 15-10 3zm15-22 7 7" />
          </>
        ) : kind === 'face' ? (
          <>
            <circle cx="38" cy="38" r="25" fill="var(--surface-soft)" />
            <path d="M28 31h1m18 0h1M27 43q11 12 22 0" />
          </>
        ) : kind === 'person' ? (
          <>
            <circle cx="38" cy="24" r="11" fill="var(--surface-soft)" />
            <path d="M17 62v-7a21 21 0 0 1 42 0v7M28 62V50m20 12V50" />
          </>
        ) : kind === 'leaf' ? (
          <>
            <path
              d="M18 57C10 29 33 12 61 14c2 28-15 51-43 43Z"
              fill="var(--surface-soft)"
            />
            <path d="m14 62 35-36M26 50V34m0 16h17" />
          </>
        ) : kind === 'questionnaire' ? (
          <>
            <rect
              x="20"
              y="12"
              width="36"
              height="50"
              rx="5"
              fill="var(--surface-soft)"
            />
            <path d="M27 26h21M27 35h21M27 44h12" />
            <circle cx="54" cy="54" r="11" fill="var(--surface)" />
            <path d="m49 54 4 4 6-8" />
          </>
        ) : kind === 'pause' ? (
          <>
            <circle cx="38" cy="38" r="25" fill="var(--surface-soft)" />
            <path d="M32 28v20M44 28v20" />
          </>
        ) : kind === 'path' ? (
          <>
            <path d="M14 57C25 39 39 30 61 18" />
            <circle cx="14" cy="57" r="4" fill="var(--teal-deep)" />
            <circle cx="61" cy="18" r="6" fill="var(--surface-soft)" />
          </>
        ) : kind === 'done' ? (
          <path d="m21 39 11 11 24-27" strokeWidth="2.5" />
        ) : (
          <>
            <path
              d="M13 21c9-4 18-4 25 3 7-7 16-7 25-3v35c-9-4-18-4-25 3-7-7-16-7-25-3z"
              fill="var(--terracotta-soft)"
              stroke="var(--terracotta)"
            />
            <path d="M38 24v35" stroke="var(--terracotta)" />
          </>
        )}
      </svg>
    </div>
  )
}

export default function HomeNextStepCard({
  home,
  destination,
  remaining,
  resourceCategory,
  onRetry,
}: Readonly<{
  home: HomeNextStep
  destination?: string
  remaining?: number
  resourceCategory?: PublicResourceSummary['category']
  onRetry: () => void
}>) {
  const view = homeNextStepView(home, destination, remaining)
  const action = view.occurrence
    ? actionPresentation[view.occurrence.actionType]
    : undefined
  const hotline = CRISIS_SUPPORT_CONTENT.contacts[0]
  const trail = homeJourneyTrail(home)
  const mamTarget = useMamTarget(
    view.safety ? null : { kind: 'home.next-step' },
  )

  return (
    <section
      ref={mamTarget}
      aria-label="Bước tiếp theo"
      className={`home-next-step${view.safety ? ' home-next-step--safety' : ''}`}
      data-home-state={view.state}
      data-page-motion="off"
    >
      {!view.safety && (
        <ol className="home-trail" aria-label="Hành trình của bạn">
          {trail.map((step, index) => (
            <li
              key={step.label}
              className={`home-trail-step home-trail-${step.status}`}
              aria-current={step.status === 'current' ? 'step' : undefined}
            >
              {index > 0 && (
                <div
                  className={`home-trail-connector home-line${step.status !== 'upcoming' ? ' is-complete' : ''}`}
                  aria-hidden="true"
                  style={
                    { '--home-delay': `${100 + index * 60}ms` } as CSSProperties
                  }
                />
              )}
              <div
                className="home-trail-node home-pop"
                aria-hidden="true"
                style={
                  { '--home-delay': `${40 + index * 80}ms` } as CSSProperties
                }
              >
                {step.status === 'done' ? (
                  <Check size={12} />
                ) : step.status === 'current' ? (
                  <div />
                ) : null}
              </div>
              <div>{step.label}</div>
            </li>
          ))}
        </ol>
      )}
      <div className="home-band-row">
        <Illustration home={home} resourceCategory={resourceCategory} />
        <div className="home-band-copy">
          <div className="home-eyebrow">
            {view.safety
              ? 'Hỗ trợ ngay bây giờ'
              : view.occurrence
                ? 'Việc tiếp theo hôm nay'
                : view.state.startsWith('ASSESSMENT')
                  ? 'Kiểm tra ban đầu'
                  : 'Bước tiếp theo'}
          </div>
          <h2 className={`home-title${view.safety ? '' : ' home-wipe'}`}>
            {view.title}
          </h2>
          {!view.occurrence && (
            <div className="home-description">{view.description}</div>
          )}
          {action && (
            <div className="home-action-meta">
              <div className="home-chip">
                <action.Icon size={16} aria-hidden="true" />
                {view.occurrence?.actionType === 'RESOURCE' && resourceCategory
                  ? homeResourceTypeLabel(resourceCategory)
                  : action.label}
              </div>
              {view.occurrence?.estimatedDurationMinutes != null && (
                <div className="home-chip">
                  {view.occurrence.estimatedDurationMinutes} phút
                </div>
              )}
              {home.plan && (
                <div className="home-today-progress">
                  <div className="home-today-dots" aria-hidden="true">
                    {Array.from(
                      { length: Math.min(home.plan.today.total, 12) },
                      (_, index) => (
                        <div
                          key={index}
                          className={`home-today-dot home-pop${index < (home.plan?.today.completed ?? 0) ? ' is-complete' : ''}`}
                          style={
                            {
                              '--home-delay': `${260 + Math.min(index, 3) * 40}ms`,
                            } as CSSProperties
                          }
                        />
                      ),
                    )}
                  </div>
                  <div>
                    {home.plan.today.completed === 0
                      ? `${home.plan.today.total} việc cho hôm nay`
                      : `Đã xong ${home.plan.today.completed} trong ${home.plan.today.total} việc hôm nay`}
                  </div>
                  {view.remaining != null && (
                    <div className="sr-only">
                      Còn {view.remaining} việc hôm nay
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {view.entitlementUnavailable && (
            <div className="home-entitlement-note">
              Chưa kiểm tra được gói của bạn; bạn vẫn dùng được hướng dẫn.
            </div>
          )}
          {view.safety && (
            <div className="home-help">
              <a
                className="home-help-phone"
                href={hotline.href}
                aria-label={`Gọi ${hotline.name} số ${hotline.displayPhone}`}
              >
                <Phone size={20} aria-hidden="true" />
                Gọi {hotline.displayPhone}
              </a>
              <div>
                {hotline.name} · {hotline.availability}
              </div>
            </div>
          )}
        </div>
        <div className="home-band-actions">
          <Link
            className={view.safety ? 'home-quiet-link' : 'home-primary'}
            href={view.primary.href}
          >
            {view.primary.label}
            <ArrowRight className="home-arrow" size={18} aria-hidden="true" />
          </Link>
          {view.contextual.length > 0 && (
            <nav className="home-context" aria-label="Liên kết liên quan">
              {view.contextual.slice(0, 2).map((link) =>
                'retry' in link ? (
                  <button key={link.label} type="button" onClick={onRetry}>
                    {link.label}
                  </button>
                ) : (
                  <Link key={link.label} href={link.href}>
                    {link.label}
                  </Link>
                ),
              )}
            </nav>
          )}
        </div>
      </div>
    </section>
  )
}
