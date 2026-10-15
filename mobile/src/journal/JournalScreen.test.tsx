import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'
import { Alert } from 'react-native'

import { ApiError } from '@/api/api-error'
import type { AppSession } from '@/auth/session'

import { JournalEditor } from './JournalEditor'
import { comparisonPeriods, JournalScreen } from './JournalScreen'
import {
  entry,
  journalApi,
  missing,
  page,
  subject,
} from './journal-test-fixtures'

let mockSession: AppSession | null = { subject, role: 'USER' }
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession }),
}))
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'private',
}))

async function mount(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
  return {
    ...(await render(
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
    )),
    client,
  }
}
const editorProps = (api = journalApi()) => ({
  api,
  subject,
  onClose: jest.fn(),
  onDirtyChange: jest.fn(),
})

describe('Private mobile Journal CRUD', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSession = { subject, role: 'USER' }
  })
  it('creates a journal with explicit mood while consent is missing', async () => {
    const props = editorProps()
    await mount(<JournalEditor {...props} />)
    expect(screen.getByTestId('journal-save')).toBeDisabled()
    await fireEvent.changeText(
      screen.getByLabelText('Nội dung nhật ký'),
      entry.content.text,
    )
    await fireEvent.press(screen.getByRole('radio', { name: 'Cảm xúc: Tốt' }))
    await fireEvent.press(screen.getByTestId('journal-save'))
    await screen.findByText('Đã lưu nhật ký.')
    expect(props.api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { text: entry.content.text },
        mood: 'GOOD',
        tags: [],
      }),
      expect.any(String),
    )
    await screen.findByText('Bạn chưa cho phép AI xử lý nhật ký.')
    expect(props.api.requestAnalysis).not.toHaveBeenCalled()
  })
  it('edits a loaded entry with its exact revision and invalidates old AI', async () => {
    const props = editorProps(
      journalApi({
        revise: jest.fn().mockResolvedValue({
          ...entry,
          currentRevision: 2,
          analysisState: 'stale',
          content: { ...entry.content, text: 'Nội dung mới.' },
        }),
      }),
    )
    await mount(<JournalEditor {...props} initialEntry={entry} />)
    await fireEvent.changeText(
      screen.getByLabelText('Nội dung nhật ký'),
      'Nội dung mới.',
    )
    await fireEvent.press(screen.getByTestId('journal-save'))
    await screen.findByText('Đã lưu nhật ký.')
    expect(props.api.revise).toHaveBeenCalledWith(
      entry.id,
      1,
      { content: { text: 'Nội dung mới.' }, mood: 'GOOD', tags: ['công việc'] },
      expect.any(String),
    )
    await screen.findByText(
      'Bài viết đã được sửa; phản ánh cũ không dùng cho bản mới này.',
    )
  })
  it('retains the draft and blocks save on stale revision until an explicit reload', async () => {
    const latest = {
      ...entry,
      currentRevision: 2,
      content: { ...entry.content, text: 'Đã sửa trên thiết bị khác.' },
    }
    const props = editorProps(
      journalApi({
        revise: jest.fn().mockRejectedValue(
          new ApiError({
            message: 'private backend message',
            status: 409,
            code: 'CONFLICT',
          }),
        ),
        detail: jest.fn().mockResolvedValue(latest),
      }),
    )
    await mount(<JournalEditor {...props} initialEntry={entry} />)
    await fireEvent.changeText(
      screen.getByLabelText('Nội dung nhật ký'),
      'Bản đang viết chưa lưu.',
    )
    await fireEvent.press(screen.getByTestId('journal-save'))
    await screen.findByText(/Bài viết đã thay đổi ở nơi khác/)
    expect(screen.getByLabelText('Nội dung nhật ký')).toHaveDisplayValue(
      'Bản đang viết chưa lưu.',
    )
    expect(screen.getByTestId('journal-save')).toBeDisabled()
    expect(props.api.detail).not.toHaveBeenCalled()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Mở bản mới nhất, bỏ phần chưa lưu' }),
    )
    await screen.findByText(
      'Đã mở bản mới nhất. Bạn có thể tiếp tục chỉnh sửa.',
    )
    expect(screen.getByLabelText('Nội dung nhật ký')).toHaveDisplayValue(
      latest.content.text,
    )
    expect(screen.queryByText('private backend message')).toBeNull()
  })
  it('retries an unknown save using the same body/key without allowing edits in between', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(entry)
    await mount(<JournalEditor {...editorProps(journalApi({ create }))} />)
    await fireEvent.changeText(
      screen.getByLabelText('Nội dung nhật ký'),
      entry.content.text,
    )
    await fireEvent.press(screen.getByRole('radio', { name: 'Cảm xúc: Tốt' }))
    await fireEvent.press(screen.getByTestId('journal-save'))
    await screen.findByText(/Chưa xác nhận được lần lưu vừa rồi/)
    expect(screen.getByLabelText('Nội dung nhật ký')).toHaveProp(
      'editable',
      false,
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lưu lại' }))
    await screen.findByText('Đã lưu nhật ký.')
    expect(create.mock.calls[1]).toEqual(create.mock.calls[0])
  })
  it('requires confirmation before deleting, refreshes history, and closes the editor', async () => {
    const props = editorProps()
    const { client } = await mount(
      <JournalEditor {...props} initialEntry={entry} />,
    )
    const invalidate = jest.spyOn(client, 'invalidateQueries')
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa bài viết' }))
    expect(props.api.remove).not.toHaveBeenCalled()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận xóa bài viết' }),
    )
    await waitFor(() => expect(props.onClose).toHaveBeenCalled())
    expect(props.api.remove).toHaveBeenCalledWith(entry.id, expect.any(String))
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['journal', subject, 'list'],
    })
  })
  it('asks before abandoning an unsaved draft', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    const props = editorProps()
    await mount(<JournalEditor {...props} />)
    await fireEvent.changeText(
      screen.getByLabelText('Nội dung nhật ký'),
      'Chưa lưu.',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Về danh sách nhật ký' }),
    )
    expect(alert).toHaveBeenCalledWith(
      'Rời bài viết?',
      expect.any(String),
      expect.any(Array),
    )
    expect(props.onClose).not.toHaveBeenCalled()
    alert.mockRestore()
  })

  it('keeps a draft but locks save/AI when a background GET supplies a newer revision', async () => {
    const props = editorProps()
    const { client, rerender } = await mount(
      <JournalEditor {...props} initialEntry={entry} />,
    )
    await fireEvent.changeText(
      screen.getByLabelText('Nội dung nhật ký'),
      'Draft vẫn ở đây.',
    )
    await rerender(
      <QueryClientProvider client={client}>
        <JournalEditor
          {...props}
          initialEntry={{ ...entry, currentRevision: 2 }}
        />
      </QueryClientProvider>,
    )
    expect(screen.getByLabelText('Nội dung nhật ký')).toHaveDisplayValue(
      'Draft vẫn ở đây.',
    )
    expect(screen.getByTestId('journal-save')).toBeDisabled()
    expect(props.api.revise).not.toHaveBeenCalled()
    expect(props.api.requestAnalysis).not.toHaveBeenCalled()
  })
  it('loads a saved entry again after remount rather than restoring raw local content', async () => {
    const api = journalApi()
    const first = await mount(<JournalScreen api={api} onBack={jest.fn()} />)
    await fireEvent.press(
      await screen.findByTestId(`journal-entry-${entry.id}`),
    )
    await waitFor(() =>
      expect(screen.getByLabelText('Nội dung nhật ký')).toHaveDisplayValue(
        entry.content.text,
      ),
    )
    await first.unmount()
    await mount(<JournalScreen api={api} onBack={jest.fn()} />)
    await fireEvent.press(
      await screen.findByTestId(`journal-entry-${entry.id}`),
    )
    await waitFor(() => expect(api.detail).toHaveBeenCalledTimes(2))
  })
  it('drops drafts when the subject changes without a screen remount', async () => {
    const api = journalApi({
      list: jest.fn().mockResolvedValue(page([])),
      authorization: jest.fn().mockResolvedValue(missing),
    })
    const onBack = jest.fn()
    const { rerender, client } = await mount(
      <JournalScreen api={api} onBack={onBack} />,
    )
    await fireEvent.press(screen.getByTestId('journal-new'))
    await fireEvent.changeText(
      screen.getByLabelText('Nội dung nhật ký'),
      'Riêng tư của tài khoản A.',
    )
    mockSession = {
      subject: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      role: 'USER',
    }
    await rerender(
      <QueryClientProvider client={client}>
        <JournalScreen api={api} onBack={onBack} />
      </QueryClientProvider>,
    )
    expect(screen.queryByLabelText('Nội dung nhật ký')).toBeNull()
    await fireEvent.press(screen.getByTestId('journal-new'))
    expect(screen.getByLabelText('Nội dung nhật ký')).toHaveDisplayValue('')
    expect(screen.getByTestId('journal-save')).toBeDisabled()
    expect(api.create).not.toHaveBeenCalled()
  })
  it.each([401, 403, 503])(
    'keeps a new draft available when history fails with %s',
    async (status) => {
      const api = journalApi({
        list: jest
          .fn()
          .mockRejectedValue(
            new ApiError({ status, code: 'ERROR', message: 'raw details' }),
          ),
      })
      await mount(<JournalScreen api={api} onBack={jest.fn()} />)
      await screen.findByRole('button', { name: 'Tải lại danh sách' })
      await fireEvent.press(screen.getByTestId('journal-new'))
      expect(screen.getByLabelText('Nội dung nhật ký')).toHaveDisplayValue('')
      expect(screen.queryByText('raw details')).toBeNull()
    },
  )
  it('uses equal half-open complete UTC windows without deriving data coverage', () => {
    expect(comparisonPeriods(7, new Date('2026-10-07T13:00:00Z'))).toEqual({
      previousPeriod: {
        startAt: '2026-09-23T00:00:00.000Z',
        endAt: '2026-09-30T00:00:00.000Z',
      },
      currentPeriod: {
        startAt: '2026-09-30T00:00:00.000Z',
        endAt: '2026-10-07T00:00:00.000Z',
      },
    })
  })
})
