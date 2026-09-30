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
  const [mediaBusy, setMediaBusy] = useState(false)
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
    const input = { content: normalized, topics: selected, mediaIds }
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
          <p>Một câu chuyện thật có thể giúp ai đó thấy mình không đơn độc.</p>
        </div>
        <button type="button" onClick={() => setExpanded(true)}>
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
      <CommunityMediaUploader disabled={submitting} onChange={updateMedia} />
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
