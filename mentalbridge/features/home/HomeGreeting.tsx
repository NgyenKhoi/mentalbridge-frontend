'use client'

import { useEffect, useState } from 'react'
import type { HomeNextStep } from '@/features/assessment/api/care-contract'
import { homeGreeting } from './home-presentation'

export function HomeGreeting({
  home,
  safety,
}: Readonly<{ home: HomeNextStep | null; safety: boolean }>) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const update = () => setNow(new Date())
    const initial = window.setTimeout(update, 0)
    const timer = window.setInterval(update, 60_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [])
  const evening = now ? now.getHours() >= 18 || now.getHours() < 5 : false
  const plan = home?.plan

  return (
    <header
      className="home-greeting"
      data-home-time={
        now
          ? evening
            ? 'evening'
            : now.getHours() < 12
              ? 'morning'
              : 'afternoon'
          : undefined
      }
    >
      <div
        className="home-date-tile"
        aria-label={
          now
            ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(
                now,
              )
            : 'Hôm nay'
        }
      >
        <div className="home-date-weekday">
          {now
            ? new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(now)
            : 'Hôm nay'}
        </div>
        <div className="home-date-number">{now ? now.getDate() : '—'}</div>
        <div className="home-date-month">
          {now
            ? new Intl.DateTimeFormat('vi-VN', { month: 'long' }).format(now)
            : ''}
        </div>
      </div>
      <div className="home-greeting-copy">
        <h1>{now ? homeGreeting(now.getHours()) : 'Chào bạn'}</h1>
        <div className="home-greeting-subline">
          {safety ? (
            'Bạn không cần đi qua lúc này một mình.'
          ) : (
            <>
              Một bước nhỏ hôm nay là đủ.
              {plan?.cycleDay != null && plan.cycleLengthDays != null
                ? ` Bạn đang ở ngày ${plan.cycleDay} của kế hoạch ${plan.cycleLengthDays} ngày.`
                : ''}
            </>
          )}
        </div>
      </div>
      {!safety && (
        <svg
          className="home-sprig"
          width="220"
          height="150"
          viewBox="0 0 220 150"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="168"
            cy="40"
            r="20"
            fill="var(--amber-soft)"
            stroke="var(--amber-deep)"
            strokeWidth="1.4"
          />
          {evening && <circle cx="176" cy="34" r="17" fill="var(--bg-deep)" />}
          <g
            stroke="var(--teal)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path className="home-leaf" d="M30 146 C70 126 110 96 150 52" />
            <path
              className="home-leaf"
              d="M66 125 C55 105 60 90 76 82 C82 99 79 114 66 125Z"
              fill="var(--teal-pale)"
            />
            <path
              className="home-leaf"
              d="M94 104 C107 86 124 82 137 89 C126 104 111 110 94 104Z"
              fill="var(--surface-soft)"
            />
            <path
              className="home-leaf"
              d="M114 80 C107 61 114 48 129 42 C134 59 127 72 114 80Z"
              fill="var(--teal-pale)"
            />
          </g>
          <g fill="var(--amber-deep)">
            <circle cx="40" cy="30" r="1.6" />
            <circle cx="78" cy="18" r="1.2" />
            <circle cx="206" cy="86" r="1.4" />
          </g>
        </svg>
      )}
    </header>
  )
}
