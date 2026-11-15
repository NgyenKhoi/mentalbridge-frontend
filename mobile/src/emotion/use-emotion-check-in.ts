import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'

import type { EmotionApi } from './emotion-api'
import type { EmotionCheckIn } from './emotion-contract'
import { emptyDraft, savedDraft, type Draft } from './emotion-presentation'

export const emotionKeys = {
  today: (subject: string | undefined, localDate: string) =>
    ['emotion-check-in', subject, 'today', localDate] as const,
  history: (subject: string | undefined, limit: number) =>
    ['emotion-check-in', subject, 'history', limit] as const,
  progress: (subject: string | undefined, timezone: string) =>
    ['emotion-check-in', subject, 'progress', timezone] as const,
}

export type EmotionCopy = Readonly<{
  conflict: string
  failure: (error: unknown) => string
}>
type Notice = { message: string; tone: 'error' | 'success' }
type SaveCommand = Readonly<{
  subject: string
  localDate: string
  timezone: string
  scope: string
  draft: Draft
  current: EmotionCheckIn | null
}>
type DeleteCommand = Readonly<{
  subject: string
  localDate: string
  timezone: string
  scope: string
}>

export function localDateInTimeZone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404
}

function draftSyncKey(
  subject: string | undefined,
  localDate: string,
  checkIn: EmotionCheckIn | null,
) {
  const ownerKey = subject ?? 'no-subject'
  return checkIn
    ? `${ownerKey}:${localDate}:${checkIn.id}:${checkIn.revision}`
    : `${ownerKey}:${localDate}:empty`
}

/** Today's check-in: query, editable draft, save (idempotent, revisioned) and delete. */
export function useEmotionCheckIn({
  api,
  now = () => new Date(),
  timezone: timezoneOverride,
  copy,
}: Readonly<{
  api: EmotionApi
  now?: () => Date
  timezone?: string | undefined
  copy: EmotionCopy
}>) {
  const { session } = useSession()
  const queryClient = useQueryClient()
  const subject = session?.subject
  const timezone = useMemo(
    () =>
      timezoneOverride ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      'UTC',
    [timezoneOverride],
  )
  const localDate = useMemo(
    () => localDateInTimeZone(now(), timezone),
    [now, timezone],
  )
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pendingDeleteDate, setPendingDeleteDate] = useState<string | null>(
    null,
  )
  const syncedDraftKey = useRef<string | undefined>(undefined)
  const scope = `${subject}:${localDate}:${timezone}`
  const currentScope = useRef(scope)
  useLayoutEffect(() => {
    currentScope.current = scope
  }, [scope])
  const saveKey = useRef<{ signature: string; key: string } | null>(null)

  const todayQuery = useQuery({
    queryKey: emotionKeys.today(subject, localDate),
    enabled: Boolean(subject),
    refetchOnMount: 'always',
    queryFn: async () => {
      try {
        return await api.getCheckIn(localDate)
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },
  })
  const current = todayQuery.data ?? null

  useEffect(() => {
    if (!subject || !todayQuery.isSuccess) return
    const syncKey = draftSyncKey(subject, localDate, current)
    if (syncedDraftKey.current === syncKey) return
    syncedDraftKey.current = syncKey
    setDraft(current ? savedDraft(current) : emptyDraft)
    setNotice(null)
    setPendingDeleteDate(null)
  }, [current, localDate, subject, todayQuery.isSuccess])

  const refreshHistoryAndProgress = async (owner: {
    subject: string
    timezone: string
  }) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['emotion-check-in', owner.subject, 'history'],
      }),
      queryClient.invalidateQueries({
        queryKey: emotionKeys.progress(owner.subject, owner.timezone),
      }),
    ])
  }

  const saveMutation = useMutation({
    mutationFn: async (command: SaveCommand) => {
      if (!command.draft.emotion || !command.draft.intensity) {
        throw new Error('Emotion check-in draft is incomplete')
      }
      const value = {
        emotion: command.draft.emotion,
        intensity: command.draft.intensity,
        factors: [...command.draft.factors],
        note: command.draft.note.trim() || null,
      }
      const signature = JSON.stringify([
        command.scope,
        command.current?.revision,
        value,
      ])
      if (saveKey.current?.signature !== signature)
        saveKey.current = { signature, key: randomUUID() }
      return command.current
        ? api.updateCheckIn(
            command.localDate,
            command.current.revision,
            value,
            saveKey.current.key,
          )
        : api.createCheckIn(
            {
              ...value,
              localDate: command.localDate,
              timezone: command.timezone,
            },
            saveKey.current.key,
          )
    },
    onSuccess: async (saved, command) => {
      queryClient.setQueryData(
        emotionKeys.today(command.subject, command.localDate),
        saved,
      )
      if (currentScope.current === command.scope) {
        syncedDraftKey.current = draftSyncKey(
          command.subject,
          command.localDate,
          saved,
        )
        setDraft(savedDraft(saved))
        saveKey.current = null
        setNotice({
          message: command.current
            ? 'Đã cập nhật ghi nhận hôm nay.'
            : 'Đã lưu ghi nhận hôm nay.',
          tone: 'success',
        })
      }
      await refreshHistoryAndProgress(command)
    },
    onError: async (error, command) => {
      if (currentScope.current !== command.scope) return
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 412)
      ) {
        const refreshed = await todayQuery.refetch()
        if (currentScope.current !== command.scope) return
        if (refreshed.isSuccess && refreshed.data) {
          syncedDraftKey.current = draftSyncKey(
            subject,
            localDate,
            refreshed.data,
          )
          setDraft(savedDraft(refreshed.data))
        }
        setNotice({ message: copy.conflict, tone: 'error' })
        return
      }
      setNotice({ message: copy.failure(error), tone: 'error' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (command: DeleteCommand) =>
      api.deleteCheckIn(command.localDate, randomUUID()),
    onSuccess: async (tombstone, command) => {
      queryClient.setQueryData(
        emotionKeys.today(command.subject, tombstone.localDate),
        null,
      )
      if (
        currentScope.current === command.scope &&
        tombstone.localDate === localDate
      ) {
        syncedDraftKey.current = draftSyncKey(
          command.subject,
          tombstone.localDate,
          null,
        )
        setDraft(emptyDraft)
      }
      queryClient.setQueriesData<{ items: readonly EmotionCheckIn[] }>(
        { queryKey: ['emotion-check-in', command.subject, 'history'] },
        (history) =>
          history
            ? {
                ...history,
                items: history.items.filter(
                  ({ localDate: date }) => date !== tombstone.localDate,
                ),
              }
            : history,
      )
      if (currentScope.current === command.scope) {
        setPendingDeleteDate(null)
        setNotice({ message: 'Đã xóa ghi nhận đã chọn.', tone: 'success' })
      }
      await refreshHistoryAndProgress(command)
    },
    onError: (error, command) => {
      if (currentScope.current === command.scope)
        setNotice({ message: copy.failure(error), tone: 'error' })
    },
  })

  const dirty = current
    ? current.emotion !== draft.emotion ||
      current.intensity !== draft.intensity ||
      current.note !== (draft.note.trim() || null) ||
      current.factors.join(',') !== draft.factors.join(',')
    : draft.emotion !== null
  const saveDisabled =
    !draft.emotion ||
    !draft.intensity ||
    saveMutation.isPending ||
    deleteMutation.isPending ||
    (current !== null && !dirty)

  return {
    subject,
    timezone,
    localDate,
    scope,
    todayQuery,
    current,
    draft,
    notice,
    dirty,
    saveDisabled,
    pendingDeleteDate,
    setPendingDeleteDate,
    saveMutation,
    deleteMutation,
    /** Any edit also clears the last notice. */
    editDraft: (update: (value: Draft) => Draft) => {
      setDraft(update)
      setNotice(null)
    },
    save: (onSaved?: () => void) => {
      if (!subject) return
      saveMutation.mutate(
        { subject, localDate, timezone, scope, draft, current },
        onSaved ? { onSuccess: onSaved } : undefined,
      )
    },
    remove: (date: string) => {
      if (!subject) return
      deleteMutation.mutate({ subject, localDate: date, timezone, scope })
    },
  }
}
