import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import { VideoSessionPanel } from './VideoConsultationPanel'

const api = vi.hoisted(() => ({
  session: vi.fn(),
  access: vi.fn(),
  complete: vi.fn(),
}))
vi.mock('../api/video-browser-client', () => ({ videoBrowserClient: api }))
vi.mock('next/dynamic', () => ({
  default: () =>
    function Media(props: {
      access: unknown
      onLeave: () => void
      onError: () => void
    }) {
      return (
        <div>
          {props.access ? (
            <>
              <span>SDK connected</span>
              <button onClick={props.onLeave}>Rời cuộc gọi</button>
              <button onClick={props.onError}>SDK failure</button>
            </>
          ) : (
            <span>Local device preview</span>
          )}
        </div>
      )
    },
}))

const id = '10000000-0000-4000-8000-000000000001'
const active = {
  appointmentId: id,
  phase: 'ACTIVE',
  previewAllowed: true,
  joinAllowed: true,
  startsAt: '2026-10-13T01:00:00Z',
  endsAt: '2026-10-13T02:00:00Z',
  serverTime: '2026-10-13T01:01:00Z',
  version: 3,
  completion: null,
}
const issued = {
  appointmentId: id,
  endsAt: active.endsAt,
  expiresAt: '2026-10-13T01:03:00Z',
  participantToken: 'private.test.token',
  serverUrl: 'wss://test.livekit.cloud',
}
const pending = {
  appointmentId: id,
  confirmationId: id,
  verificationState: 'PENDING_VERIFICATION',
  appointmentStatus: 'SESSION_ENDED',
  creditState: 'HELD',
  completionFactId: null,
  acceptedAt: active.serverTime,
  manualReviewAt: '2026-10-14T01:01:00Z',
  version: 4,
}
function view(role: 'USER' | 'SPECIALIST' = 'USER') {
  return render(
    <FeedbackProvider>
      <VideoSessionPanel appointmentId={id} role={role} />
    </FeedbackProvider>,
  )
}
describe('appointment video authority and intent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.session.mockResolvedValue(active)
    api.access.mockResolvedValue(issued)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })
  it('waits for authority; previews without requesting a token', async () => {
    let resolve!: (value: unknown) => void
    api.session.mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    view()
    expect(
      screen.getByText('Đang kiểm tra quyền vào phiên…'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
    ).toBeDisabled()
    await act(async () =>
      resolve({ ...active, phase: 'WAITING', joinAllowed: false }),
    )
    expect(screen.getByText('Local device preview')).toBeInTheDocument()
    expect(api.access).not.toHaveBeenCalled()
  })
  it('freshly checks eligibility, joins and leaves without completion or token DOM', async () => {
    const user = userEvent.setup()
    view()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
      ).toBeEnabled(),
    )
    await user.click(
      screen.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
    )
    expect(await screen.findByText('SDK connected')).toBeInTheDocument()
    expect(api.session).toHaveBeenCalledTimes(2)
    expect(document.body.innerHTML).not.toContain(issued.participantToken)
    await user.click(screen.getByRole('button', { name: 'Rời cuộc gọi' }))
    expect(screen.queryByText('SDK connected')).not.toBeInTheDocument()
    expect(api.complete).not.toHaveBeenCalled()
    expect(
      screen.queryByText('Xác nhận kết thúc buổi tư vấn'),
    ).not.toBeInTheDocument()
  })
  it.each(['NOT_AVAILABLE', 'ENDED', 'UNAVAILABLE', 'TOO_EARLY'])(
    'does not connect in %s',
    async (phase) => {
      api.session.mockResolvedValue({
        ...active,
        phase,
        previewAllowed: false,
        joinAllowed: false,
      })
      view()
      await waitFor(() => expect(api.session).toHaveBeenCalled())
      expect(
        screen.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
      ).toBeDisabled()
      expect(api.access).not.toHaveBeenCalled()
    },
  )
  it('does not use stale eligibility after cancellation before join', async () => {
    const user = userEvent.setup()
    view()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
      ).toBeEnabled(),
    )
    api.session.mockResolvedValue({
      ...active,
      phase: 'NOT_AVAILABLE',
      joinAllowed: false,
      previewAllowed: false,
      version: 4,
    })
    await user.click(
      screen.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
    )
    expect(api.access).not.toHaveBeenCalled()
  })
  it('fails closed on unauthorized lookup and token retrieval errors', async () => {
    api.session.mockRejectedValue(
      new ApiError({
        code: 'FORBIDDEN',
        message: 'private detail',
        status: 403,
      }),
    )
    view()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn không có quyền',
    )
    api.session.mockResolvedValue(active)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Tải lại phiên' }))
    api.access.mockRejectedValue(new Error('private.test.token'))
    await user.click(
      screen.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể kết nối',
    )
    expect(document.body.innerHTML).not.toContain('private.test.token')
  })
  it('disconnects in the background and does not automatically reconnect', async () => {
    const user = userEvent.setup()
    view()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
      ).toBeEnabled(),
    )
    await user.click(
      screen.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
    )
    await screen.findByText('SDK connected')
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(screen.queryByText('SDK connected')).not.toBeInTheDocument()
    expect(api.access).toHaveBeenCalledTimes(1)
  })
  it('requires explicit Specialist intent, safe initial dialog focus and replays ambiguous command', async () => {
    const user = userEvent.setup()
    api.complete
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(pending)
    view('SPECIALIST')
    await user.click(
      await screen.findByRole('button', {
        name: 'Xác nhận kết thúc buổi tư vấn',
      }),
    )
    expect(
      screen.getByRole('button', { name: 'Tiếp tục tư vấn' }),
    ).toHaveFocus()
    expect(api.complete).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Kết thúc và gửi xác nhận' }),
    )
    await screen.findByText('Kiểm tra lại xác nhận')
    const original = api.complete.mock.calls[0]
    expect(original[0]).toBe(id)
    expect(original[1]).toBe(3)
    api.session.mockResolvedValue({
      ...active,
      phase: 'ENDED',
      previewAllowed: false,
      joinAllowed: false,
      completion: pending,
      version: 4,
    })
    await user.click(
      screen.getByRole('button', { name: 'Kiểm tra lại xác nhận' }),
    )
    expect(api.complete.mock.calls[1]).toEqual(original)
    expect(await screen.findByText(/Đã nhận xác nhận/)).toBeInTheDocument()
    expect(
      screen.queryByText('Buổi tư vấn đã được xác nhận hoàn tất.'),
    ).not.toBeInTheDocument()
  })
})
