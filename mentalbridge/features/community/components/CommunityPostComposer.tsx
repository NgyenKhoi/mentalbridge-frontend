'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { ApiError } from '@/lib/api/api-error'
import {
  createCommunityPost,
  type CommunityTopic,
  type CommunityTopicCode,
} from '@/features/community/api/browser-community'
import CommunityMediaUploader from './CommunityMediaUploader'
import CommunityResourceSelector from './CommunityResourceSelector'

const MAX_CONTENT = 5000

export default function CommunityPostComposer({
  topics,
}: Readonly<{ topics: CommunityTopic[] }>) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [content, setContent] = useState('')
  const [selected, setSelected] = useState<CommunityTopicCode[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [authorMode, setAuthorMode] = useState<'PROFILE' | 'ANONYMOUS'>(
    'PROFILE',
  )
  const [mediaBusy, setMediaBusy] = useState(false)
  const [resourceId, setResourceId] = useState<string | null>(null)
  const [sensitiveContentWarning, setSensitiveContentWarning] = useState<
    'SENSITIVE_CONTENT' | null
  >(null)
  const [message, setMessage] = useState('')
  const command = useRef<{ signature: string; key: string } | undefined>(
    undefined,
  )
  const length = [...content].length
  const updateMedia = useCallback(
    ({ mediaIds: readyIds, busy }: { mediaIds: string[]; busy: boolean }) => {
      setMediaIds(readyIds)
      setMediaBusy(busy)
    },
    [],
  )

  function toggle(topic: CommunityTopicCode) {
    setMessage('')
    setSelected((current) =>
      current.includes(topic)
        ? current.filter((value) => value !== topic)
        : current.length < 3
          ? [...current, topic]
          : current,
    )
  }

  async function submit() {
    const normalized = content.trim()
    if (!normalized || length > MAX_CONTENT || selected.length === 0) {
      setMessage('Hãy nhập nội dung và chọn từ một đến ba chủ đề.')
      return
    }
    if (mediaBusy) {
      setMessage('Hãy chờ tệp tải lên xong trước khi đăng bài.')
      return
    }
    const input = {
      content: normalized,
      topics: selected,
      mediaIds,
      authorMode,
      resourceId,
      sensitiveContentWarning,
    }
    const signature = JSON.stringify(input)
    if (!command.current || command.current.signature !== signature) {
      command.current = { signature, key: crypto.randomUUID() }
    }
    setSubmitting(true)
    setMessage('')
    try {
      const result = await createCommunityPost(input, command.current.key)
      command.current = undefined
      router.push(`/community/${result.post.postId}`)
    } catch (cause) {
      setMessage(
        cause instanceof ApiError && cause.status === 409
          ? 'Nội dung hoặc ảnh đính kèm không còn hợp lệ. Hãy kiểm tra và thử lại.'
          : 'Bài viết chưa thể đăng lúc này. Bạn có thể thử lại.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!expanded) {
    return (
      <section className="community-composer community-composer-collapsed">
        <div>
          <strong>Bạn muốn chia sẻ điều gì?</strong>
          <p>
            {topics.length > 0
              ? 'Một câu chuyện thật có thể giúp ai đó thấy mình không đơn độc.'
              : 'Chủ đề đang được cập nhật. Bạn có thể quay lại viết bài sau.'}
          </p>
        </div>
        <button
          type="button"
          disabled={topics.length === 0}
          onClick={() => setExpanded(true)}
        >
          Viết bài
        </button>
      </section>
    )
  }

  return (
    <section className="community-composer" aria-labelledby="composer-title">
      <h2 id="composer-title">Chia sẻ câu chuyện của bạn</h2>
      <p>
        Chỉ chia sẻ điều bạn thấy an toàn. Nội dung cộng đồng không được dùng
        làm hồ sơ chăm sóc hay dữ liệu AI.
      </p>
      <label htmlFor="community-post-content">Nội dung</label>
      <textarea
        id="community-post-content"
        value={content}
        maxLength={MAX_CONTENT * 2}
        onChange={(event) => {
          setContent(event.target.value)
          setMessage('')
        }}
        rows={7}
        placeholder="Viết trải nghiệm, suy nghĩ hoặc một bước tiến nhỏ…"
      />
      <span className={length > MAX_CONTENT ? 'is-invalid' : ''}>
        {length}/{MAX_CONTENT} ký tự
      </span>
      <fieldset>
        <legend>Chọn 1–3 chủ đề</legend>
        <div className="community-topic-choices">
          {topics.map((topic) => (
            <label key={topic.code}>
              <input
                type="checkbox"
                checked={selected.includes(topic.code)}
                disabled={
                  !selected.includes(topic.code) && selected.length >= 3
                }
                onChange={() => toggle(topic.code)}
              />
              <span>{topic.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="community-identity-choices">
        <legend>Bạn muốn xuất hiện như thế nào?</legend>
        <p>
          Lựa chọn này chỉ áp dụng cho bài viết này và có thể thay đổi khi chỉnh
          sửa.
        </p>
        <div>
          <label>
            <input
              type="radio"
              name="community-author-mode"
              value="PROFILE"
              checked={authorMode === 'PROFILE'}
              onChange={() => setAuthorMode('PROFILE')}
            />
            <span>
              <strong>Dùng danh tính cộng đồng</strong>
              <small>Hiển thị tên và hình đại diện bạn đã chọn.</small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="community-author-mode"
              value="ANONYMOUS"
              checked={authorMode === 'ANONYMOUS'}
              onChange={() => setAuthorMode('ANONYMOUS')}
            />
            <span>
              <strong>Đăng ẩn danh</strong>
              <small>
                Người đọc không thấy hay liên kết được danh tính cộng đồng của
                bạn; MentalBridge vẫn giữ quyền sở hữu để bảo vệ an toàn.
              </small>
            </span>
          </label>
        </div>
      </fieldset>
      <CommunityMediaUploader disabled={submitting} onChange={updateMedia} />
      <CommunityResourceSelector
        value={resourceId}
        disabled={submitting}
        onChange={(value) => {
          setResourceId(value)
          setMessage('')
        }}
      />
      <fieldset className="community-sensitive-choice">
        <legend>Cảnh báo nội dung</legend>
        <label>
          <input
            type="checkbox"
            checked={sensitiveContentWarning === 'SENSITIVE_CONTENT'}
            onChange={(event) => {
              setSensitiveContentWarning(
                event.target.checked ? 'SENSITIVE_CONTENT' : null,
              )
              setMessage('')
            }}
          />
          <span>
            <strong>Thêm cảnh báo nội dung nhạy cảm</strong>
            <small>
              Dùng khi câu chuyện có chi tiết người đọc có thể muốn chuẩn bị
              trước. Đây không phải nhãn chẩn đoán hay đánh giá mức độ.
            </small>
          </span>
        </label>
      </fieldset>
      {message && (
        <p className="community-form-error" role="alert">
          {message}
        </p>
      )}
      <div className="community-form-actions">
        <button type="button" onClick={() => setExpanded(false)}>
          Để sau
        </button>
        <button
          type="button"
          disabled={submitting || mediaBusy || length > MAX_CONTENT}
          onClick={() => void submit()}
        >
          {submitting ? 'Đang đăng…' : 'Đăng câu chuyện'}
        </button>
      </div>
    </section>
  )
}
