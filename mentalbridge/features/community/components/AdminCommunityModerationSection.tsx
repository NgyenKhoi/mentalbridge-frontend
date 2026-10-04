'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createCommunityModerationAction,
  getCommunityModerationCases,
  type CreateModerationActionRequest,
  type ModerationCase,
} from '@/features/community/api/browser-community'
import styles from './AdminCommunityModerationSection.module.css'

const ACTIONS: ReadonlyArray<{
  value: CreateModerationActionRequest['action']
  label: string
}> = [
  { value: 'NO_ACTION', label: 'Không cần xử lý' },
  { value: 'HIDE', label: 'Ẩn nội dung' },
  { value: 'REMOVE', label: 'Gỡ nội dung' },
  { value: 'RESTORE', label: 'Khôi phục' },
  { value: 'RESTRICT_COMMUNITY_ACCESS', label: 'Hạn chế quyền Community' },
]
const POST_WARNING_ACTIONS: ReadonlyArray<{
  value: CreateModerationActionRequest['action']
  label: string
}> = [
  { value: 'APPLY_SENSITIVE_WARNING', label: 'Thêm cảnh báo nhạy cảm' },
  { value: 'REMOVE_SENSITIVE_WARNING', label: 'Gỡ cảnh báo nhạy cảm' },
]

export default function AdminCommunityModerationSection() {
  const [cases, setCases] = useState<ModerationCase[]>([])
  const [state, setState] = useState('OPEN')
  const [targetType, setTargetType] = useState('')
  const [priority, setPriority] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState<
    Record<string, CreateModerationActionRequest>
  >({})
  const commands = useRef(new Map<string, { signature: string; key: string }>())

  const requestCases = useCallback(
    () =>
      getCommunityModerationCases({
        state: state || undefined,
        targetType: targetType || undefined,
        priority: priority || undefined,
      }),
    [priority, state, targetType],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setMessage('')
    try {
      setCases(await requestCases())
    } catch {
      setMessage('Chưa thể tải hàng đợi kiểm duyệt. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [requestCases])

  useEffect(() => {
    let active = true
    void requestCases()
      .then((items) => {
        if (active) setCases(items)
      })
      .catch(() => {
        if (active)
          setMessage('Chưa thể tải hàng đợi kiểm duyệt. Vui lòng thử lại.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [requestCases])

  function draft(item: ModerationCase): CreateModerationActionRequest {
    return (
      drafts[item.caseId] ?? {
        action: 'NO_ACTION',
        reasonCode: 'REVIEWED_NO_ACTION',
      }
    )
  }

  async function apply(item: ModerationCase) {
    const input = draft(item)
    if (!/^[A-Z0-9_]{1,64}$/.test(input.reasonCode)) {
      setMessage('Mã lý do chỉ gồm chữ in hoa, số và dấu gạch dưới.')
      return
    }
    const signature = JSON.stringify(input)
    const current = commands.current.get(item.caseId)
    if (!current || current.signature !== signature)
      commands.current.set(item.caseId, { signature, key: crypto.randomUUID() })
    setBusyId(item.caseId)
    setMessage('')
    try {
      const updated = await createCommunityModerationAction(
        item.caseId,
        input,
        commands.current.get(item.caseId)!.key,
      )
      commands.current.delete(item.caseId)
      setCases((values) =>
        state === 'OPEN'
          ? values.filter((value) => value.caseId !== item.caseId)
          : values.map((value) =>
              value.caseId === item.caseId ? updated : value,
            ),
      )
      setMessage('Quyết định đã được ghi vào nhật ký kiểm duyệt.')
    } catch {
      setMessage(
        'Chưa thể ghi quyết định. Lệnh được giữ nguyên để thử lại an toàn.',
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section
      className={styles.root}
      aria-labelledby="community-moderation-title"
    >
      <span className={styles.eyebrow}>Community an toàn</span>
      <h1 id="community-moderation-title">Kiểm duyệt cộng đồng</h1>
      <p>
        Xem bằng chứng tối thiểu cần thiết và áp dụng quyết định có nhật ký. Mức
        ưu tiên khủng hoảng chỉ dùng để sắp hàng đợi, không phải chẩn đoán.
      </p>
      <div className={styles.filters}>
        <label>
          Trạng thái
          <select
            value={state}
            onChange={(event) => setState(event.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="OPEN">Đang mở</option>
            <option value="IN_REVIEW">Đang xem xét</option>
            <option value="RESOLVED">Đã xử lý</option>
          </select>
        </label>
        <label>
          Loại nội dung
          <select
            value={targetType}
            onChange={(event) => setTargetType(event.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="POST">Bài viết</option>
            <option value="COMMENT">Bình luận</option>
          </select>
        </label>
        <label>
          Ưu tiên
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="HIGH">Cao</option>
            <option value="NORMAL">Thường</option>
          </select>
        </label>
        <button type="button" onClick={() => void load()} disabled={loading}>
          Tải lại
        </button>
      </div>
      {message && (
        <p role="status" className={styles.message}>
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">Đang tải hàng đợi…</p>
      ) : cases.length === 0 ? (
        <div className={styles.empty}>Không có trường hợp phù hợp bộ lọc.</div>
      ) : (
        <div className={styles.list}>
          {cases.map((item) => {
            const input = draft(item)
            return (
              <article key={item.caseId} className={styles.card}>
                <header>
                  <strong>
                    {item.targetType === 'POST' ? 'Bài viết' : 'Bình luận'}
                  </strong>
                  <span
                    className={
                      item.priority === 'HIGH' ? styles.high : undefined
                    }
                  >
                    {item.priority === 'HIGH'
                      ? 'Ưu tiên cao'
                      : 'Ưu tiên thường'}
                  </span>
                </header>
                <p className={styles.reasons}>
                  {item.reportReasons.join(' · ')}
                </p>
                {item.reportContexts.length > 0 && (
                  <ul
                    className={styles.contexts}
                    aria-label="Ngữ cảnh từ báo cáo"
                  >
                    {item.reportContexts.map((context, index) => (
                      <li key={`${item.caseId}-context-${index}`}>{context}</li>
                    ))}
                  </ul>
                )}
                <blockquote>{item.evidence.content}</blockquote>
                <small>
                  Trạng thái bằng chứng: {item.evidence.state} · phiên bản{' '}
                  {item.evidence.version}
                </small>
                {item.actions.length > 0 && (
                  <details>
                    <summary>Nhật ký ({item.actions.length})</summary>
                    <ol>
                      {item.actions.map((action) => (
                        <li key={action.actionId}>
                          {action.action} · {action.reasonCode} ·{' '}
                          {action.priorState} → {action.resultingState}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                <div className={styles.decision}>
                  <label>
                    Quyết định
                    <select
                      value={input.action}
                      onChange={(event) =>
                        setDrafts((values) => ({
                          ...values,
                          [item.caseId]: {
                            ...input,
                            action: event.target
                              .value as CreateModerationActionRequest['action'],
                          },
                        }))
                      }
                    >
                      {(item.targetType === 'POST'
                        ? [...ACTIONS, ...POST_WARNING_ACTIONS]
                        : ACTIONS
                      ).map((action) => (
                        <option key={action.value} value={action.value}>
                          {action.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Mã lý do
                    <input
                      value={input.reasonCode}
                      onChange={(event) =>
                        setDrafts((values) => ({
                          ...values,
                          [item.caseId]: {
                            ...input,
                            reasonCode: event.target.value.toUpperCase(),
                          },
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busyId === item.caseId}
                    onClick={() => void apply(item)}
                  >
                    {busyId === item.caseId ? 'Đang ghi…' : 'Ghi quyết định'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
