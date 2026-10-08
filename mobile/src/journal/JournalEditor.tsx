import { useMutation, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, Text, TextInput, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { PrimaryButton } from '@/components/PrimaryButton'

import { JournalAnalysisPanel } from './JournalAnalysisPanel'
import type { JournalApi } from './journal-api'
import {
  journalWriteSchema,
  type JournalCreate,
  type JournalEntry,
  type JournalMood,
  type JournalWrite,
} from './journal-contract'
import {
  journalError,
  journalStyles as s,
  Notice,
  TextAction,
} from './journal-ui'

const moods: readonly { value: JournalMood; label: string }[] = [
  { value: 'GREAT', label: 'Rất tốt' },
  { value: 'GOOD', label: 'Tốt' },
  { value: 'OKAY', label: 'Bình thường' },
  { value: 'LOW', label: 'Không tốt' },
  { value: 'VERY_LOW', label: 'Rất không tốt' },
]
const draftOf = (entry?: JournalEntry) => ({
  text: entry?.content.text ?? '',
  mood: entry?.mood ?? null,
  tags: entry?.tags.join(', ') ?? '',
})
type SaveAttempt = {
  key: string
  body: JournalCreate | JournalWrite
  entry: JournalEntry | undefined
}

export function JournalEditor({
  api,
  subject,
  initialEntry,
  onClose,
  onDirtyChange,
}: Readonly<{
  api: JournalApi
  subject: string
  initialEntry?: JournalEntry
  onClose: () => void
  onDirtyChange: (dirty: boolean) => void
}>) {
  const client = useQueryClient()
  const [entry, setEntry] = useState(initialEntry)
  const [draft, setDraft] = useState(() => draftOf(initialEntry))
  const [notice, setNotice] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const attempt = useRef<SaveAttempt | null>(null)
  const deleteKey = useRef<string | null>(null)
  const original = draftOf(entry)
  const newerSource = Boolean(
    entry &&
    initialEntry?.id === entry.id &&
    initialEntry.currentRevision > entry.currentRevision,
  )
  const dirty =
    draft.text !== original.text ||
    draft.mood !== original.mood ||
    draft.tags !== original.tags
  const parsed = journalWriteSchema.safeParse({
    content: { text: draft.text },
    mood: draft.mood,
    tags:
      entry && draft.tags === original.tags
        ? entry.tags
        : draft.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
  })
  useEffect(() => {
    onDirtyChange(dirty || uncertain)
    return () => onDirtyChange(false)
  }, [dirty, uncertain, onDirtyChange])
  const refresh = () =>
    client.invalidateQueries({ queryKey: ['journal', subject, 'list'] })
  const save = useMutation({
    mutationFn: async () => {
      if (!attempt.current) {
        if (!parsed.success) throw new Error('Incomplete Journal draft')
        attempt.current = {
          key: randomUUID(),
          entry,
          body: entry
            ? parsed.data
            : {
                ...parsed.data,
                clientEntryId: randomUUID(),
                occurredAt: new Date().toISOString(),
              },
        }
      }
      const request = attempt.current
      return request.entry
        ? api.revise(
            request.entry.id,
            request.entry.currentRevision,
            request.body,
            request.key,
          )
        : api.create(request.body as JournalCreate, request.key)
    },
    onSuccess: async (saved) => {
      setEntry(saved)
      setDraft(draftOf(saved))
      attempt.current = null
      setUncertain(false)
      setConflict(false)
      setNotice('Đã lưu nhật ký.')
      client.setQueryData(['journal', subject, 'detail', saved.id], saved)
      await refresh()
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 412)
      ) {
        attempt.current = null
        setUncertain(false)
        setConflict(true)
        setNotice(
          'Bài viết đã thay đổi ở nơi khác. Nội dung bạn đang viết được giữ lại; cần xem bản mới nhất trước khi lưu tiếp.',
        )
      } else if (
        error instanceof ApiError &&
        error.status &&
        error.status < 500
      ) {
        attempt.current = null
        setUncertain(false)
        setNotice(journalError(error))
      } else {
        setUncertain(true)
        setNotice(
          'Chưa xác nhận được lần lưu vừa rồi. Thử lưu lại để kiểm tra cùng yêu cầu, không tạo bài trùng.',
        )
      }
    },
  })
  const reload = useMutation({
    mutationFn: () => api.detail(entry!.id),
    onSuccess: (latest) => {
      setEntry(latest)
      setDraft(draftOf(latest))
      setConflict(false)
      setNotice('Đã mở bản mới nhất. Bạn có thể tiếp tục chỉnh sửa.')
    },
    onError: (error) => setNotice(journalError(error)),
  })
  const remove = useMutation({
    mutationFn: () => {
      deleteKey.current ??= randomUUID()
      return api.remove(entry!.id, deleteKey.current)
    },
    onSuccess: async () => {
      client.removeQueries({
        queryKey: ['journal', subject, 'detail', entry!.id],
      })
      await refresh()
      onClose()
    },
    onError: (error) => setNotice(journalError(error)),
  })
  const busy = save.isPending || remove.isPending || reload.isPending
  const locked = busy || uncertain
  const close = () => {
    if (!dirty && !uncertain) return onClose()
    Alert.alert(
      'Rời bài viết?',
      uncertain
        ? 'Lần lưu vừa rồi chưa được xác nhận. Bạn có thể quay lại danh sách để kiểm tra.'
        : 'Phần chưa lưu sẽ mất khi rời màn hình.',
      [
        { text: 'Tiếp tục viết', style: 'cancel' },
        { text: 'Rời bài viết', style: 'destructive', onPress: onClose },
      ],
    )
  }
  return (
    <>
      <View style={s.panel}>
        <Text accessibilityRole="header" style={s.heading}>
          {entry ? 'Nhật ký của bạn' : 'Hôm nay bạn muốn viết gì?'}
        </Text>
        <Text style={s.body}>
          Chỉ bạn có thể mở bài viết này. AI chỉ được xử lý khi bạn chủ động yêu
          cầu.
        </Text>
        <Text style={s.label}>Nội dung nhật ký</Text>
        <TextInput
          accessibilityLabel="Nội dung nhật ký"
          testID="journal-text"
          multiline
          textAlignVertical="top"
          value={draft.text}
          editable={!locked}
          maxLength={12000}
          onChangeText={(text) => {
            setDraft((value) => ({ ...value, text }))
            setNotice(null)
          }}
          style={[s.input, { minHeight: 160 }]}
          placeholder="Một điều đã xảy ra, một cảm xúc hoặc điều bạn muốn giữ lại…"
        />
        <Text style={s.source}>{draft.text.length}/12.000 ký tự</Text>
        <Text style={s.label}>Bạn cảm thấy thế nào?</Text>
        <View accessibilityRole="radiogroup" style={s.row}>
          {moods.map((mood) => (
            <Pressable
              key={mood.value}
              accessibilityRole="radio"
              accessibilityLabel={`Cảm xúc: ${mood.label}`}
              accessibilityState={{
                checked: draft.mood === mood.value,
                disabled: locked,
              }}
              disabled={locked}
              testID={`journal-mood-${mood.value}`}
              onPress={() =>
                setDraft((value) => ({ ...value, mood: mood.value }))
              }
              style={[s.choice, draft.mood === mood.value && s.selected]}
            >
              <Text style={s.label}>{mood.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.label}>Nhãn (không bắt buộc)</Text>
        <TextInput
          accessibilityLabel="Nhãn nhật ký"
          value={draft.tags}
          editable={!locked}
          onChangeText={(tags) => setDraft((value) => ({ ...value, tags }))}
          style={s.input}
          placeholder="Ví dụ: công việc, gia đình"
        />
        <Text style={s.source}>
          Tối đa 20 nhãn, mỗi nhãn 40 ký tự; ngăn cách bằng dấu phẩy.
        </Text>
        {!parsed.success && dirty && (
          <Notice>
            Viết nội dung, chọn cảm xúc và kiểm tra độ dài các nhãn trước khi
            lưu.
          </Notice>
        )}
        {notice && (
          <Notice error={save.isError || reload.isError || remove.isError}>
            {notice}
          </Notice>
        )}
        {newerSource && (
          <Notice error>
            Bài viết đã có bản mới hơn. Nội dung đang viết được giữ lại; mở bản
            mới nhất trước khi lưu hoặc yêu cầu AI.
          </Notice>
        )}
        {(conflict || newerSource) && (
          <TextAction
            label="Mở bản mới nhất, bỏ phần chưa lưu"
            disabled={busy}
            onPress={() => reload.mutate()}
          />
        )}
        <PrimaryButton
          testID="journal-save"
          label={
            save.isPending
              ? 'Đang lưu…'
              : uncertain
                ? 'Thử lưu lại'
                : 'Lưu nhật ký'
          }
          disabled={
            busy ||
            conflict ||
            newerSource ||
            !parsed.success ||
            (!dirty && !uncertain)
          }
          onPress={() => save.mutate()}
        />
        <TextAction
          label="Về danh sách nhật ký"
          disabled={busy}
          onPress={close}
          testID="journal-editor-back"
        />
        {entry && !uncertain && !confirmDelete && (
          <TextAction
            label="Xóa bài viết"
            disabled={busy}
            onPress={() => setConfirmDelete(true)}
          />
        )}
        {confirmDelete && (
          <View>
            <Notice error>
              Xóa bài viết này? Bài viết sẽ không còn trong nhật ký và không
              được dùng cho yêu cầu AI mới.
            </Notice>
            <TextAction
              label="Xác nhận xóa bài viết"
              disabled={busy}
              onPress={() => remove.mutate()}
            />
            <TextAction
              label="Giữ bài viết"
              disabled={busy}
              onPress={() => setConfirmDelete(false)}
            />
          </View>
        )}
      </View>
      {entry && (
        <JournalAnalysisPanel
          key={`${subject}:${entry.id}:${entry.currentRevision}`}
          api={api}
          subject={subject}
          target={{
            kind: 'EXACT',
            journalId: entry.id,
            revision: entry.currentRevision,
          }}
          blocked={dirty || conflict || newerSource || uncertain || busy}
          stale={entry.analysisState === 'stale'}
        />
      )}
    </>
  )
}
