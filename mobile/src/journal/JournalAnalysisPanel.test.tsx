import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'

import { ApiError } from '@/api/api-error'

import type { AnalysisRequestStore } from './analysis-request-store'
import { JournalAnalysisPanel } from './JournalAnalysisPanel'
import type { AnalysisTarget } from './journal-contract'
import {
  completed,
  disclosure,
  entry,
  failed,
  granted,
  journalApi,
  missing,
  running,
  subject,
  trend,
} from './journal-test-fixtures'

const target: AnalysisTarget = {
  kind: 'EXACT',
  journalId: entry.id,
  revision: 1,
}
const mockOpenProfile = jest.fn()
jest.mock('expo-router', () => ({
  router: { push: (path: string) => mockOpenProfile(path) },
}))
function store(): AnalysisRequestStore {
  return {
    read: jest.fn().mockResolvedValue(null),
    write: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  }
}
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

describe('Explicit mobile Journal AI', () => {
  it('explains a missing Care profile without granting consent or blocking manual writing', async () => {
    const api = journalApi({
      consent: jest
        .fn()
        .mockRejectedValue(
          new ApiError({
            status: 404,
            code: 'PROFILE_NOT_FOUND',
            message: 'private details',
          }),
        ),
    })
    await mount(
      <JournalAnalysisPanel
        api={api}
        subject={subject}
        target={target}
        store={store()}
      />,
    )
    await screen.findByText(disclosure.title)
    await fireEvent.press(screen.getByTestId('journal-ai-consent-check'))
    await fireEvent.press(screen.getByTestId('journal-ai-consent'))
    await screen.findByText(
      'Cần hoàn tất hồ sơ cá nhân trước khi lưu sự đồng ý cho AI. Bạn vẫn có thể viết và lưu nhật ký.',
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Mở hồ sơ cá nhân để tiếp tục' }),
    )
    expect(mockOpenProfile).toHaveBeenCalledWith('./profile')
    expect(api.requestAnalysis).not.toHaveBeenCalled()
    expect(screen.getByTestId('journal-ai-request')).toBeDisabled()
    expect(screen.queryByText('private details')).toBeNull()
  })
  it.each(['MISSING', 'REVOKED', 'POLICY_OUTDATED'] as const)(
    'blocks AI for %s without auto-requesting consent or processing',
    async (reason) => {
      const api = journalApi({
        authorization: jest.fn().mockResolvedValue({ ...missing, reason }),
      })
      await mount(
        <JournalAnalysisPanel
          api={api}
          subject={subject}
          target={target}
          store={store()}
        />,
      )
      await screen.findByText(disclosure.title)
      expect(screen.getByTestId('journal-ai-request')).toBeDisabled()
      expect(screen.getByTestId('journal-ai-consent')).toBeDisabled()
      expect(api.consent).not.toHaveBeenCalled()
      expect(api.requestAnalysis).not.toHaveBeenCalled()
    },
  )
  it('requires an explicit checkbox and grant, then rechecks authorization before processing', async () => {
    let allowed = false
    const api = journalApi({
      authorization: jest
        .fn()
        .mockImplementation(async () => (allowed ? granted : missing)),
      consent: jest.fn().mockImplementation(async () => {
        allowed = true
      }),
    })
    const persistence = store()
    await mount(
      <JournalAnalysisPanel
        api={api}
        subject={subject}
        target={target}
        store={persistence}
      />,
    )
    await screen.findByText(disclosure.title)
    await fireEvent.press(screen.getByTestId('journal-ai-consent-check'))
    await fireEvent.press(screen.getByTestId('journal-ai-consent'))
    await screen.findByRole('button', { name: 'Rút lại sự đồng ý cho AI' })
    expect(api.consent).toHaveBeenCalledWith(
      disclosure.version,
      true,
      expect.any(String),
    )
    await fireEvent.press(screen.getByTestId('journal-ai-request'))
    await screen.findByTestId('journal-ai-completed')
    expect(api.authorization).toHaveBeenCalledTimes(3)
    expect(api.requestAnalysis).toHaveBeenCalledWith(
      entry.id,
      1,
      expect.any(String),
    )
    expect(persistence.write).toHaveBeenCalledWith(subject, `${entry.id}.1`, {
      requestKey: expect.any(String),
      jobId: running.jobId,
    })
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xem nguồn phản ánh' }),
    )
    expect(screen.getByText(`Bài viết ${entry.id} · bản đã lưu 1`)).toBeTruthy()
  })
  it('does not process when cached consent was revoked just before the request', async () => {
    const api = journalApi({
      authorization: jest
        .fn()
        .mockResolvedValueOnce(granted)
        .mockResolvedValue({ ...missing, reason: 'REVOKED' }),
    })
    await mount(
      <JournalAnalysisPanel
        api={api}
        subject={subject}
        target={target}
        store={store()}
      />,
    )
    await screen.findByRole('button', { name: 'Rút lại sự đồng ý cho AI' })
    await fireEvent.press(screen.getByTestId('journal-ai-request'))
    await screen.findByText(
      'Sự đồng ý đã thay đổi. Kiểm tra lại trước khi yêu cầu AI.',
    )
    expect(api.requestAnalysis).not.toHaveBeenCalled()
  })
  it('renders queued/processing from the authoritative job only', async () => {
    const api = journalApi({
      authorization: jest.fn().mockResolvedValue(granted),
      analysisJob: jest.fn().mockResolvedValue(running),
    })
    await mount(
      <JournalAnalysisPanel
        api={api}
        subject={subject}
        target={target}
        store={store()}
      />,
    )
    await screen.findByRole('button', { name: 'Rút lại sự đồng ý cho AI' })
    await fireEvent.press(screen.getByTestId('journal-ai-request'))
    await screen.findByText('Yêu cầu đang chờ xử lý.')
    expect(screen.queryByTestId('journal-ai-completed')).toBeNull()
    expect(screen.queryByTestId('journal-ai-request')).toBeNull()
  })
  it.each([
    'PROVIDER_UNAVAILABLE',
    'PROVIDER_TIMEOUT',
    'ENTITLEMENT_UNAVAILABLE',
    'ENTITLEMENT_CHANGED',
    'INVALID_PROVIDER_RESULT',
  ] as const)(
    'keeps %s truthful, and retry explicit',
    async (terminalReason) => {
      const api = journalApi({
        authorization: jest.fn().mockResolvedValue(granted),
        analysisJob: jest.fn().mockResolvedValue({ ...failed, terminalReason }),
      })
      await mount(
        <JournalAnalysisPanel
          api={api}
          subject={subject}
          target={target}
          store={store()}
        />,
      )
      await screen.findByRole('button', { name: 'Rút lại sự đồng ý cho AI' })
      await fireEvent.press(screen.getByTestId('journal-ai-request'))
      await screen.findByTestId('journal-ai-failed')
      expect(screen.queryByTestId('journal-ai-completed')).toBeNull()
      expect(api.requestAnalysis).toHaveBeenCalledTimes(1)
      await fireEvent.press(screen.getByTestId('journal-ai-request'))
      await waitFor(() => expect(api.requestAnalysis).toHaveBeenCalledTimes(2))
      expect(api.authorization).toHaveBeenCalledTimes(3)
    },
  )
  it('restores only a server GET after app remount, never another POST', async () => {
    const persistence = store()
    jest.mocked(persistence.read).mockResolvedValue({
      requestKey: 'previous-request-123',
      jobId: running.jobId,
    })
    const api = journalApi({
      authorization: jest.fn().mockResolvedValue(granted),
    })
    const first = await mount(
      <JournalAnalysisPanel
        api={api}
        subject={subject}
        target={target}
        store={persistence}
      />,
    )
    await screen.findByTestId('journal-ai-completed')
    await first.unmount()
    await mount(
      <JournalAnalysisPanel
        api={api}
        subject={subject}
        target={target}
        store={persistence}
      />,
    )
    await screen.findByTestId('journal-ai-completed')
    expect(api.analysisJob).toHaveBeenCalledTimes(2)
    expect(api.requestAnalysis).not.toHaveBeenCalled()
    expect(persistence.write).not.toHaveBeenCalled()
  })
  it('reconciles an ambiguous submission with the stored same key only on explicit retry', async () => {
    const persistence = store()
    jest
      .mocked(persistence.read)
      .mockResolvedValue({ requestKey: 'previous-request-123' })
    const api = journalApi({
      authorization: jest.fn().mockResolvedValue(granted),
    })
    await mount(
      <JournalAnalysisPanel
        api={api}
        subject={subject}
        target={target}
        store={persistence}
      />,
    )
    await screen.findByText(
      'Lần gửi trước chưa được xác nhận. Thử lại sẽ kiểm tra cùng yêu cầu.',
    )
    expect(api.requestAnalysis).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('journal-ai-request'))
    await screen.findByTestId('journal-ai-completed')
    expect(api.requestAnalysis).toHaveBeenCalledWith(
      entry.id,
      1,
      'previous-request-123',
    )
  })
  it('fails closed on cross-revision job output', async () => {
    const persistence = store()
    jest.mocked(persistence.read).mockResolvedValue({
      requestKey: 'previous-request-123',
      jobId: running.jobId,
    })
    const api = journalApi({
      authorization: jest.fn().mockResolvedValue(granted),
      analysisJob: jest
        .fn()
        .mockResolvedValue({ ...completed, journalRevision: 2 }),
    })
    await mount(
      <JournalAnalysisPanel
        api={api}
        subject={subject}
        target={target}
        store={persistence}
      />,
    )
    await screen.findByText(
      'Chưa tải được trạng thái yêu cầu. Không tạo yêu cầu mới hay kết quả thay thế.',
    )
    expect(screen.queryByText(completed.result!.summary!)).toBeNull()
    expect(screen.queryByTestId('journal-ai-request')).toBeNull()
  })
  it('uses server coverage and preserves source windows without inventing a trend for sparse data', async () => {
    const api = journalApi({
      authorization: jest.fn().mockResolvedValue(granted),
    })
    await mount(
      <JournalAnalysisPanel
        api={api}
        subject={subject}
        target={{
          kind: 'TREND',
          request: {
            previousPeriod: trend.previousPeriod,
            currentPeriod: trend.currentPeriod,
          },
        }}
        store={store()}
      />,
    )
    await screen.findByRole('button', { name: 'Rút lại sự đồng ý cho AI' })
    await fireEvent.press(screen.getByTestId('journal-ai-request'))
    await screen.findByText(
      'Chưa đủ dữ liệu để so sánh hai khoảng. Ngày không có nhật ký không được xem là cảm xúc tốt lên hoặc xấu đi.',
    )
    expect(
      screen.getByText(
        'Dữ liệu được dùng: 0 bài ở khoảng trước, 1 bài ở khoảng hiện tại.',
      ),
    ).toBeTruthy()
    expect(screen.queryByText('So sánh do hệ thống trả về')).toBeNull()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xem nguồn phản ánh' }),
    )
    expect(screen.getByText(`Hiện tại: ${entry.id} · bản 1`)).toBeTruthy()
  })
  it('does not request when correlation storage or consent dependency is unavailable', async () => {
    const persistence = store()
    jest.mocked(persistence.read).mockRejectedValue(new Error('storage'))
    const api = journalApi({
      authorization: jest
        .fn()
        .mockRejectedValue(
          new ApiError({ message: 'private', code: 'DOWN', status: 503 }),
        ),
    })
    await mount(
      <JournalAnalysisPanel
        api={api}
        subject={subject}
        target={target}
        store={persistence}
      />,
    )
    await screen.findByText(
      'Chưa kiểm tra được quyền xử lý AI. Bạn vẫn có thể viết và lưu nhật ký.',
    )
    expect(screen.getByTestId('journal-ai-request')).toBeDisabled()
    expect(api.requestAnalysis).not.toHaveBeenCalled()
  })
  it('blocks analysis of unsaved edits', async () => {
    const api = journalApi({
      authorization: jest.fn().mockResolvedValue(granted),
    })
    await mount(
      <JournalAnalysisPanel
        api={api}
        subject={subject}
        target={target}
        store={store()}
        blocked
      />,
    )
    await screen.findByRole('button', { name: 'Rút lại sự đồng ý cho AI' })
    expect(screen.getByTestId('journal-ai-request')).toBeDisabled()
  })

  it('blocks stale-source POST conflicts until the entry is reopened', async () => {
    const api = journalApi({
      authorization: jest.fn().mockResolvedValue(granted),
      requestAnalysis: jest
        .fn()
        .mockRejectedValue(
          new ApiError({ status: 409, code: 'CONFLICT', message: 'private' }),
        ),
    })
    await mount(
      <JournalAnalysisPanel
        api={api}
        subject={subject}
        target={target}
        store={store()}
      />,
    )
    await screen.findByRole('button', { name: 'Rút lại sự đồng ý cho AI' })
    await fireEvent.press(screen.getByTestId('journal-ai-request'))
    await screen.findByText(
      'Bài viết hoặc quyền xử lý đã thay đổi. Mở lại bài viết và kiểm tra sự đồng ý trước khi gửi yêu cầu mới.',
    )
    expect(screen.getByTestId('journal-ai-request')).toBeDisabled()
    expect(screen.queryByTestId('journal-ai-completed')).toBeNull()
  })
})
