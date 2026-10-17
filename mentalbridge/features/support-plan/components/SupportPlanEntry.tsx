'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import {
  getCurrentNativeSupportPlanDraft,
  getCurrentSupportPlanActions,
  getSupportPlanActionHistory,
} from '../api/browser-support-plan-actions'
import type {
  SupportPlanActionHistory,
  SupportPlanV3,
} from '../api/support-plan-contract'
import type { EmotionPlanOrigin } from '../emotion-plan-origin'
import type { JournalPlanOrigin } from '../journal-plan-origin'
import Link from 'next/link'
import SupportPlanJourney from './SupportPlanJourney'
import NativeSupportPlanJourney from './NativeSupportPlanJourney'
import './support-plan.css'

async function optionalRead(request: Promise<SupportPlanV3>) {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined
    throw error
  }
}

async function readOwnedPlans() {
  const [current, draft] = await Promise.all([
    optionalRead(getCurrentSupportPlanActions()),
    optionalRead(getCurrentNativeSupportPlanDraft()),
  ])
  if (current || draft) return { current, draft }
  try {
    const history = await getSupportPlanActionHistory()
    return { current, draft, history }
  } catch {
    return { current, draft, historyUnavailable: true }
  }
}
const loadError =
  'Chưa thể tải kế hoạch. Hãy thử lại; kế hoạch của bạn không bị thay đổi.'

export default function SupportPlanEntry({
  origin,
  journalOrigin,
  invalidJournalOrigin,
}: Readonly<{
  origin?: EmotionPlanOrigin
  journalOrigin?: JournalPlanOrigin
  invalidJournalOrigin?: boolean
}>) {
  const { confirm } = useFeedback()
  const [state, setState] = useState<{
    current?: SupportPlanV3
    draft?: SupportPlanV3
    history?: SupportPlanActionHistory
    historyUnavailable?: boolean
  }>()
  const [error, setError] = useState('')
  const [nativeEntry, setNativeEntry] = useState(false)
  const [legacyDirty, setLegacyDirty] = useState(false)
  const [entryPending, setEntryPending] = useState(false)
  const entryLock = useRef(false)
  async function enterNative() {
    if (entryLock.current) return
    entryLock.current = true
    setEntryPending(true)
    try {
      if (
        legacyDirty &&
        !(await confirm({
          title: 'Rời kế hoạch đang chỉnh sửa?',
          description:
            'Lựa chọn nội dung, lịch, ghi nhận hoạt động và tùy chọn chưa lưu sẽ bị bỏ. Ở lại để lưu trước, hoặc chủ động bỏ thay đổi để xem phương án mới.',
          confirmLabel: 'Bỏ thay đổi và xem phương án',
          cancelLabel: 'Tiếp tục chỉnh sửa',
          tone: 'warning',
        }))
      )
        return
      setNativeEntry(true)
    } finally {
      entryLock.current = false
      setEntryPending(false)
    }
  }
  const load = useCallback(async () => {
    try {
      setState(await readOwnedPlans())
      setError('')
      return true
    } catch {
      setError(loadError)
      return false
    }
  }, [])
  useEffect(() => {
    let active = true
    void readOwnedPlans()
      .then((value) => {
        if (active) setState(value)
      })
      .catch(() => {
        if (active) setError(loadError)
      })
    return () => {
      active = false
    }
  }, [])
  if (!state)
    return (
      <div className="support-plan-state" role="status">
        {error || 'Đang tải kế hoạch hỗ trợ…'}
        {error && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void load()}
          >
            Thử lại
          </button>
        )}
      </div>
    )
  const native =
    nativeEntry ||
    state.current?.representationMode === 'NATIVE_V3' ||
    state.draft?.representationMode === 'NATIVE_V3' ||
    (!state.current &&
      !state.draft &&
      state.history?.items[0]?.representationMode !== 'V2_RESOURCE_ADAPTER')
  if (native)
    return (
      <>
        {state.historyUnavailable && (
          <p className="support-plan-state" role="alert">
            Chưa thể tải lịch sử kế hoạch. Bạn vẫn có thể xem hoặc tạo kế hoạch hỗ trợ.{' '}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void load()}
            >
              Thử tải lại lịch sử
            </button>
          </p>
        )}
        {error && (
          <p className="support-plan-state" role="alert">
            {error}
          </p>
        )}
        <NativeSupportPlanJourney
          initialCurrent={state.current}
          initialDraft={state.draft}
          initialHistory={state.history}
          origin={origin}
          journalOrigin={journalOrigin}
          invalidJournalOrigin={invalidJournalOrigin}
          onBackToLegacy={
            state.current?.representationMode === 'V2_RESOURCE_ADAPTER'
              ? () => {
                  void load().then((loaded) => {
                    if (loaded) setNativeEntry(false)
                  })
                }
              : undefined
          }
        />
      </>
    )
  return (
    <>
      {(journalOrigin || invalidJournalOrigin) && (
        <p className="support-plan-state" role="status">
          Không tìm thấy hoạt động nhật ký đã mở trong kế hoạch hiện tại. Nhật
          ký của bạn không bị thay đổi.{' '}
          <Link className="btn btn-secondary" href="/journal">
            Về nhật ký
          </Link>
        </p>
      )}
      <SupportPlanJourney onDirtyChange={setLegacyDirty} />
      <section
        className="support-plan-state"
        aria-labelledby="native-alternative-title"
      >
        <h2 id="native-alternative-title">
          Muốn thêm ghi nhận cảm xúc vào kế hoạch?
        </h2>
        <p>
          Lưu lựa chọn của bạn, rồi xem một phương án mới. Kế hoạch hiện tại vẫn
          được giữ nguyên cho đến khi bạn chủ động xem xét và thay thế.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={entryPending}
          onClick={() => void enterNative()}
        >
          Xem phương án có ghi nhận cảm xúc
        </button>
      </section>
    </>
  )
}
