'use client'

import { Camera } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  getCommunityProfile,
  putCommunityProfile,
  type CommunityProfile,
} from '@/features/community/api/browser-community'
import { ApiError } from '@/lib/api/api-error'
import CommunityAvatarEditor from './CommunityAvatarEditor'
import styles from './AccountAvatarSettings.module.css'

type Versioned = { data: CommunityProfile; etag: string | null }
type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'none' }
  | ({ kind: 'ready' } & Versioned)

const notFound = (cause: unknown) =>
  cause instanceof ApiError &&
  (cause.status === 404 || cause.code === 'COMMUNITY_PROFILE_NOT_FOUND')

// Community profile names are 1-80 characters with no outer whitespace.
const profileName = (value: string) =>
  [...value.trim().normalize('NFC')].slice(0, 80).join('').trim() || 'Bạn'

export default function AccountAvatarSettings({
  displayName,
  initials,
  description,
}: Readonly<{ displayName: string; initials: string; description?: string }>) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    let active = true
    void getCommunityProfile()
      .then((result) => {
        if (active) setState({ kind: 'ready', ...result })
      })
      .catch((cause: unknown) => {
        if (active) setState({ kind: notFound(cause) ? 'none' : 'error' })
      })
    return () => {
      active = false
    }
  }, [attempt])

  const reload = useCallback(async () => {
    const result = await getCommunityProfile()
    setState({ kind: 'ready', ...result })
  }, [])
  const noop = useCallback(() => undefined, [])

  async function createProfile() {
    if (creating) return
    setCreating(true)
    setCreateError('')
    try {
      const result = await putCommunityProfile(
        { displayName: profileName(displayName), avatarPreset: null },
        null,
      )
      setState({ kind: 'ready', ...result })
    } catch {
      setCreateError('Chưa thể bắt đầu đổi ảnh. Bạn thử lại nhé.')
    } finally {
      setCreating(false)
    }
  }

  if (state.kind === 'loading')
    return (
      <p className={styles.state} role="status" aria-busy="true">
        Đang tải ảnh đại diện…
      </p>
    )

  if (state.kind === 'error')
    return (
      <div className={styles.state}>
        <p role="alert">Chưa tải được ảnh đại diện.</p>
        <button
          className={styles.action}
          type="button"
          onClick={() => {
            setState({ kind: 'loading' })
            setAttempt((value) => value + 1)
          }}
        >
          Thử tải lại
        </button>
      </div>
    )

  if (state.kind === 'none')
    return (
      <div className={styles.start}>
        <div className={styles.initials} aria-hidden="true">
          {initials}
        </div>
        <button
          className={styles.action}
          type="button"
          disabled={creating}
          aria-busy={creating}
          onClick={() => void createProfile()}
        >
          <Camera size={18} aria-hidden="true" />
          {creating ? 'Đang chuẩn bị…' : 'Đổi ảnh đại diện'}
        </button>
        {createError && (
          <p className={styles.error} role="alert">
            {createError}
          </p>
        )}
      </div>
    )

  return (
    <div className={styles.editor}>
      <CommunityAvatarEditor
        profile={state.data}
        etag={state.etag}
        disabled={false}
        onCommit={(result) => setState({ kind: 'ready', ...result })}
        onReload={reload}
        onBusyChange={noop}
        onDirtyChange={noop}
        title="Ảnh đại diện"
        description={
          description ??
          'Ảnh hiển thị cạnh tên bạn ở tài khoản và cộng đồng; không hiển thị khi đăng ẩn danh.'
        }
      />
    </div>
  )
}
