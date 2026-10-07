'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@/components/ui/Dialog'
import { Disclosure } from '@/components/ui/Disclosure'
import { ApiError } from '@/lib/api/api-error'
import {
  createCommunityPost,
  type CommunityTopic,
  type CommunityTopicCode,
} from '@/features/community/api/browser-community'
import CommunityMediaUploader from './CommunityMediaUploader'
import CommunityResourceSelector from './CommunityResourceSelector'
import styles from './CommunityPostComposer.module.css'

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
  const [contentError, setContentError] = useState('')
  const [topicsError, setTopicsError] = useState('')
  const [panel, setPanel] = useState<'media' | 'resource' | null>(null)
  const [mediaOpened, setMediaOpened] = useState(false)
  const [resourceOpened, setResourceOpened] = useState(false)
  const editor = useRef<HTMLTextAreaElement>(null)
  const topicGroup = useRef<HTMLFieldSetElement>(null)
  const publishLock = useRef(false)
  const command = useRef<{ signature: string; key: string } | undefined>(
    undefined,
  )
  const length = [...content].length
  const hasDraft = Boolean(
    content || selected.length || mediaIds.length || mediaBusy || resourceId,
  )

  useEffect(() => {
    if (expanded) editor.current?.focus()
  }, [expanded])
  useEffect(() => {
    if (!hasDraft) return
    function protectDraft(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [hasDraft])

  const updateMedia = useCallback(
    ({ mediaIds: readyIds, busy }: { mediaIds: string[]; busy: boolean }) => {
      setMediaIds(readyIds)
      setMediaBusy(busy)
    },
    [],
  )

  function toggle(topic: CommunityTopicCode) {
    setMessage('')
    setTopicsError('')
    setSelected((current) =>
      current.includes(topic)
        ? current.filter((value) => value !== topic)
        : current.length < 3
          ? [...current, topic]
          : current,
    )
  }

  async function submit() {
    if (publishLock.current) return
    const normalized = content.trim()
    if (!normalized || length > MAX_CONTENT) {
      setContentError(
        !normalized
          ? 'Viết nội dung bạn muốn chia sẻ.'
          : 'Rút gọn nội dung còn tối đa 5.000 ký tự.',
      )
      editor.current?.focus()
      return
    }
    if (selected.length === 0) {
      setTopicsError('Chọn ít nhất một chủ đề cho bài viết.')
      topicGroup.current?.querySelector('input')?.focus()
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
    if (!command.current || command.current.signature !== signature)
      command.current = { signature, key: crypto.randomUUID() }
    publishLock.current = true
    setSubmitting(true)
    setMessage('')
    try {
      const result = await createCommunityPost(input, command.current.key)
      command.current = undefined
      setContent('')
      setSelected([])
      setResourceId(null)
      setMediaIds([])
      setExpanded(false)
      router.push('/community/' + result.post.postId)
    } catch (cause) {
      setMessage(
        cause instanceof ApiError && cause.status === 409
          ? 'Nội dung hoặc ảnh đính kèm không còn hợp lệ. Hãy kiểm tra và thử lại.'
          : 'Bài viết chưa thể đăng lúc này. Bạn có thể thử lại.',
      )
    } finally {
      publishLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className={styles.launcher}>
        <span className={styles.launcherMark} aria-hidden="true">
          <ComposerIcon name="write" />
        </span>
        <div>
          <strong>Bạn muốn chia sẻ điều gì?</strong>
          <p>
            {topics.length > 0
              ? hasDraft
                ? 'Bạn có một bài viết đang soạn.'
                : 'Một suy nghĩ, một câu chuyện, một bước tiến nhỏ.'
              : 'Chủ đề đang được cập nhật. Bạn có thể quay lại viết bài sau.'}
          </p>
        </div>
        <button
          type="button"
          disabled={topics.length === 0}
          onClick={() => setExpanded(true)}
        >
          {hasDraft ? 'Viết tiếp' : 'Viết bài'}
        </button>
      </section>
      <Dialog
        open={expanded}
        onOpenChange={(open) => {
          if (!submitting) setExpanded(open)
        }}
        labelledBy="composer-title"
        className={styles.dialog}
      >
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          aria-busy={submitting}
        >
          <header className={styles.heading}>
            <div>
              <h2 id="composer-title">Tạo bài viết</h2>
              <p>Chia sẻ với cộng đồng của bạn</p>
            </div>
            <button
              type="button"
              className={styles.close}
              disabled={submitting}
              onClick={() => setExpanded(false)}
              aria-label="Đóng trình soạn bài"
            >
              <ComposerIcon name="close" />
            </button>
          </header>
          <div className={styles.body}>
            <fieldset className={styles.identity} disabled={submitting}>
              <legend>Đăng bài với</legend>
              <div className={styles.identityOptions}>
                <label>
                  <input
                    type="radio"
                    name="community-author-mode"
                    checked={authorMode === 'PROFILE'}
                    onChange={() => setAuthorMode('PROFILE')}
                    aria-label="Dùng danh tính cộng đồng"
                  />
                  <ComposerIcon name="person" />
                  <span>Danh tính cộng đồng</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="community-author-mode"
                    checked={authorMode === 'ANONYMOUS'}
                    onChange={() => setAuthorMode('ANONYMOUS')}
                  />
                  <ComposerIcon name="anonymous" />
                  <span>Đăng ẩn danh</span>
                </label>
              </div>
              <p>
                {authorMode === 'ANONYMOUS'
                  ? 'Người đọc không thấy danh tính của bạn. MentalBridge vẫn giữ thông tin người đăng để xử lý báo cáo.'
                  : 'Bài viết hiển thị tên và hình đại diện cộng đồng của bạn.'}
              </p>
            </fieldset>
            <div className={styles.editor}>
              <label className={styles.srOnly} htmlFor="community-post-content">
                Nội dung
              </label>
              <textarea
                ref={editor}
                id="community-post-content"
                value={content}
                disabled={submitting}
                aria-invalid={Boolean(contentError) || length > MAX_CONTENT}
                aria-describedby="community-content-count community-content-error"
                maxLength={MAX_CONTENT * 2}
                rows={4}
                style={{ resize: 'none' }}
                placeholder="Viết trải nghiệm, suy nghĩ hoặc một bước tiến nhỏ…"
                onChange={(event) => {
                  setContent(event.target.value)
                  setMessage('')
                  setContentError('')
                  event.target.style.height = 'auto'
                  event.target.style.height =
                    Math.max(144, event.target.scrollHeight) + 'px'
                }}
              />
              <div className={styles.editorMeta}>
                <span
                  id="community-content-error"
                  className={styles.fieldError}
                  role={
                    contentError || length > MAX_CONTENT ? 'alert' : undefined
                  }
                >
                  {contentError ||
                    (length > MAX_CONTENT
                      ? 'Nội dung vượt quá 5.000 ký tự.'
                      : '')}
                </span>
                <span
                  id="community-content-count"
                  className={length > MAX_CONTENT ? styles.fieldError : ''}
                >
                  {length.toLocaleString('vi-VN')} / 5.000
                </span>
              </div>
            </div>
            <fieldset
              ref={topicGroup}
              className={styles.topics}
              disabled={submitting}
              aria-describedby="community-topic-help community-topic-error"
            >
              <legend>Chọn 1–3 chủ đề</legend>
              <span id="community-topic-help" className={styles.topicHelp}>
                Giúp người đọc tìm thấy câu chuyện của bạn
              </span>
              <div className={styles.topicChoices}>
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
              <span
                id="community-topic-error"
                className={styles.fieldError}
                role={topicsError ? 'alert' : undefined}
              >
                {topicsError}
              </span>
            </fieldset>
            <div className={styles.attachmentToolbar}>
              <span>Thêm vào bài viết</span>
              <div>
                <button
                  type="button"
                  disabled={submitting}
                  aria-expanded={panel === 'media'}
                  aria-controls="community-composer-media"
                  onClick={() => {
                    setMediaOpened(true)
                    setPanel(panel === 'media' ? null : 'media')
                  }}
                >
                  <ComposerIcon name="image" />
                  Ảnh / video
                  {mediaBusy ? (
                    <span className={styles.attachmentCount}>Đang tải</span>
                  ) : mediaIds.length > 0 ? (
                    <span className={styles.attachmentCount}>
                      {mediaIds.length}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  aria-expanded={panel === 'resource'}
                  aria-controls="community-composer-resource"
                  onClick={() => {
                    setResourceOpened(true)
                    setPanel(panel === 'resource' ? null : 'resource')
                  }}
                >
                  <ComposerIcon name="resource" />
                  Tài nguyên
                  {resourceId && (
                    <span className={styles.attachmentCount}>1</span>
                  )}
                </button>
              </div>
            </div>
            <div
              id="community-composer-media"
              className={styles.attachmentPanel}
              hidden={panel !== 'media'}
            >
              {mediaOpened && (
                <CommunityMediaUploader
                  compact
                  disabled={submitting}
                  onChange={updateMedia}
                />
              )}
            </div>
            <div
              id="community-composer-resource"
              className={styles.attachmentPanel}
              hidden={panel !== 'resource'}
            >
              {resourceOpened && (
                <CommunityResourceSelector
                  compact
                  value={resourceId}
                  disabled={submitting}
                  onChange={(value) => {
                    setResourceId(value)
                    setMessage('')
                  }}
                />
              )}
            </div>
            <div className={styles.sensitive}>
              <label className={styles.sensitiveToggle}>
                <input
                  type="checkbox"
                  disabled={submitting}
                  checked={sensitiveContentWarning === 'SENSITIVE_CONTENT'}
                  onChange={(event) => {
                    setSensitiveContentWarning(
                      event.target.checked ? 'SENSITIVE_CONTENT' : null,
                    )
                    setMessage('')
                  }}
                />
                <ComposerIcon name="shield" />
                <span>Thêm cảnh báo nội dung nhạy cảm</span>
              </label>
              {sensitiveContentWarning && (
                <p>Người đọc cần chọn xem trước khi nội dung được mở.</p>
              )}
            </div>
            <Disclosure
              className={styles.privacy}
              summary="Quyền riêng tư khi chia sẻ"
            >
              <p>
                Chỉ chia sẻ điều bạn thấy an toàn. Nội dung cộng đồng không được
                dùng làm hồ sơ chăm sóc hay dữ liệu AI.
              </p>
            </Disclosure>
          </div>
          <footer className={styles.footer}>
            {message && (
              <p className={styles.fieldError} role="alert">
                {message}
              </p>
            )}
            <div className={styles.actions}>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setExpanded(false)}
              >
                Để sau
              </button>
              <button
                type="submit"
                disabled={submitting || mediaBusy || length > MAX_CONTENT}
              >
                <ComposerIcon name="send" />
                {submitting ? 'Đang đăng…' : 'Đăng câu chuyện'}
              </button>
            </div>
          </footer>
        </form>
      </Dialog>
    </>
  )
}

function ComposerIcon({
  name,
}: Readonly<{
  name:
    | 'write'
    | 'close'
    | 'person'
    | 'anonymous'
    | 'image'
    | 'resource'
    | 'shield'
    | 'send'
}>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'write' && (
        <>
          <path d="m14 5 5 5M4 20l5-1 12-12-5-5L4 14v6Z" />
          <path d="M14 20h6" />
        </>
      )}
      {name === 'close' && <path d="m6 6 12 12M6 18 18 6" />}
      {name === 'person' && (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </>
      )}
      {name === 'anonymous' && (
        <>
          <path d="m4 9 3-5h10l3 5H4ZM3 14h18" />
          <circle cx="7.5" cy="16" r="3" />
          <circle cx="16.5" cy="16" r="3" />
        </>
      )}
      {name === 'image' && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8" cy="8" r="1.5" />
          <path d="m3 17 5-5 4 4 4-6 5 7" />
        </>
      )}
      {name === 'resource' && (
        <path d="M12 6c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1v15" />
      )}
      {name === 'shield' && (
        <>
          <path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z" />
          <path d="M12 8v5m0 3h.01" />
        </>
      )}
      {name === 'send' && <path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15" />}
    </svg>
  )
}
