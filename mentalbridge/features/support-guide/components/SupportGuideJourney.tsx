'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '@/lib/api/api-error'
import {
  generateSupportGuide,
  getSupportGuide,
  getSupportGuideHistory,
} from '../api/browser-support-guide'
import type { SupportGuide } from '../api/support-guide-contract'
import SupportGuideCard from './SupportGuideCard'

import './support-guide.css'

function message(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'INITIAL_CHECK_INCOMPLETE')
      return 'Hãy hoàn thành PHQ-9 và GAD-7 trong Kiểm tra ban đầu trước.'
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 404)
      return 'Không tìm thấy hướng dẫn thuộc tài khoản này.'
  }
  return 'Chưa thể tải Hướng dẫn hỗ trợ. Vui lòng thử lại.'
}

export default function SupportGuideJourney({
  supportGuideId,
}: {
  supportGuideId?: string
}) {
  const [items, setItems] = useState<SupportGuide[]>([])
  const [cursor, setCursor] = useState<string>()
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string>()
  const generationKey = useRef<string | undefined>(undefined)

  const load = useCallback(
    async (next?: string) => {
      setLoading(true)
      setError(undefined)
      try {
        if (supportGuideId) {
          setItems([await getSupportGuide(supportGuideId)])
          setHasMore(false)
        } else {
          const history = await getSupportGuideHistory(next)
          setItems((current) =>
            next ? [...current, ...history.items] : history.items,
          )
          setCursor(history.nextCursor ?? undefined)
          setHasMore(history.hasMore)
        }
      } catch (cause) {
        setError(message(cause))
      } finally {
        setLoading(false)
      }
    },
    [supportGuideId],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const create = async () => {
    setGenerating(true)
    setError(undefined)
    generationKey.current ??= crypto.randomUUID()
    const key = generationKey.current
    try {
      const guide = await generateSupportGuide(key)
      setItems((current) => [
        guide,
        ...current.filter(
          (item) => item.supportGuideId !== guide.supportGuideId,
        ),
      ])
      generationKey.current = undefined
    } catch (cause) {
      setError(message(cause))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="support-guide-page">
      <header className="support-guide-page-header">
        <span>Sau sàng lọc · Hướng dẫn một lần</span>
        <h1>Hướng dẫn hỗ trợ</h1>
        <p>
          Một hướng dẫn tiêu chuẩn dùng một lần, không tạo SupportPlan theo dõi
          lâu dài.
        </p>
        {!supportGuideId && (
          <button
            className="btn btn-primary"
            type="button"
            disabled={generating}
            onClick={() => void create()}
          >
            {generating
              ? 'Đang tạo hướng dẫn…'
              : 'Tạo từ Kiểm tra ban đầu gần nhất'}
          </button>
        )}
      </header>

      {error && (
        <div className="support-guide-state error" role="alert">
          <p>{error}</p>
          <button className="btn btn-ghost" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}
      {loading && (
        <p className="support-guide-state" aria-live="polite">
          Đang tải Hướng dẫn hỗ trợ…
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="support-guide-state">
          <strong>Chưa có Hướng dẫn hỗ trợ</strong>
          <p>Hoàn thành Kiểm tra ban đầu để tạo hướng dẫn đầu tiên.</p>
          <Link className="btn btn-ghost" href="/initial-check">
            Đi tới Kiểm tra ban đầu
          </Link>
        </div>
      )}
      <section
        className="support-guide-list"
        aria-label="Lịch sử Hướng dẫn hỗ trợ"
      >
        {items.map((guide) => (
          <SupportGuideCard key={guide.supportGuideId} guide={guide} />
        ))}
      </section>
      {hasMore && !loading && (
        <button className="btn btn-ghost" onClick={() => void load(cursor)}>
          Tải thêm lịch sử
        </button>
      )}
      {supportGuideId && (
        <Link className="btn btn-ghost" href="/support-guides">
          Quay lại lịch sử Hướng dẫn hỗ trợ
        </Link>
      )}
    </div>
  )
}
