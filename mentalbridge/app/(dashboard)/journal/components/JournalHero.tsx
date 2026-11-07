'use client'

import React from 'react'

interface JournalHeroProps {
  onOpenCreate: () => void
}

export function JournalHero({ onOpenCreate }: JournalHeroProps) {
  return (
    <div className="card hero" data-user-page-header>
      <div data-user-page-heading>
        <div className="eyebrow" data-user-page-kicker>
          Nhật ký riêng tư
        </div>
        <h1>Nhật ký của bạn</h1>
        <p>Ghi lại cảm xúc và những điều bạn muốn nhìn lại theo nhịp riêng.</p>
      </div>
      <button
        type="button"
        className="btn"
        onClick={onOpenCreate}
        aria-label="Viết nhật ký mới"
      >
        ＋ Viết nhật ký
      </button>
    </div>
  )
}
