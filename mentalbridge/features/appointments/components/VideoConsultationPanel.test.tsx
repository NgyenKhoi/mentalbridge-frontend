import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import { VideoSessionPanel } from './VideoConsultationPanel'

const api = vi.hoisted(() => ({
  session: vi.fn(),
  access: vi.fn(),
  complete: vi.fn(),
  list: vi.fn(),
}))
vi.mock('../api/video-browser-client', () => ({ videoBrowserClient: api }))
vi.mock('../api/browser-client', () => ({
  appointmentBrowserClient: { list: api.list },
}))
vi.mock('next/dynamic', () => ({
  default: () =>
    function Media(props: {
      access: unknown
      onLeave: () => void
      onError: () => void
      onJoin: () => void
      hint: string
      joinDisabled: boolean
      joining: boolean
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
            <>
              <span>Local device preview</span>
              <p>{props.hint}</p>
              <button disabled={props.joinDisabled} onClick={props.onJoin}>
                {props.joining ? 'Đang xử lý…' : 'Tham gia phiên tư vấn'}
              </button>
            </>
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
  afterEach(() => vi.restoreAllMocks())
  beforeEach(() => {
    vi.clearAllMocks()
    api.session.mockResolvedValue(active)
    api.access.mockResolvedValue(issued)
    api.list.mockResolvedValue({
      items: [{ id, specialistDisplayName: 'Chuyên gia An' }],
    })
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })
  it('keeps authorized joining available when the optional display name cannot load', async () => {
    api.list.mockRejectedValueOnce(new Error('Optional name unavailable'))
    view()
    await userEvent
      .setup()
      .click(
        await screen.findByRole('button', { name: 'Tham gia phiên tư vấn' }),
      )
    expect(await screen.findByText('SDK connected')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Chuyên gia của bạn' }),
    ).toBeInTheDocument()
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
  it('keeps the same call through tab changes, blur, focus and parent rerenders', async () => {
    const user = userEvent.setup()
    const mounted = view()
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
      window.dispatchEvent(new Event('blur'))
    })
    expect(screen.getByText('SDK connected')).toBeInTheDocument()
    mounted.rerender(
      <FeedbackProvider>
        <VideoSessionPanel appointmentId={id} role="USER" />
      </FeedbackProvider>,
    )
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
    })
    expect(screen.getByText('SDK connected')).toBeInTheDocument()
    expect(api.access).toHaveBeenCalledTimes(1)
    expect(api.complete).not.toHaveBeenCalled()
  })
  it('retains an authorized call on a transient lookup outage but stops on explicit denial', async () => {
    const user = userEvent.setup()
    view()
    await user.click(
      await screen.findByRole('button', { name: 'Tham gia phiên tư vấn' }),
    )
    await screen.findByText('SDK connected')
    api.session.mockRejectedValueOnce(
      new ApiError({
        code: 'CONSULTATION_UNAVAILABLE',
        status: 503,
        message: 'private detail',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Tải lại phiên' }))
    expect(screen.getByText('SDK connected')).toBeInTheDocument()
    expect(api.access).toHaveBeenCalledOnce()
    api.session.mockRejectedValueOnce(
      new ApiError({
        code: 'FORBIDDEN',
        status: 403,
        message: 'private detail',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Tải lại phiên' }))
    expect(screen.queryByText('SDK connected')).not.toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain('private detail')
  })
  it('stops media on a real page departure, never sends a completion command', async () => {
    const user = userEvent.setup()
    view()
    await user.click(
      await screen.findByRole('button', { name: 'Tham gia phiên tư vấn' }),
    )
    await screen.findByText('SDK connected')
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(screen.queryByText('SDK connected')).not.toBeInTheDocument()
    expect(api.complete).not.toHaveBeenCalled()
  })
  it.each(['NETWORK_ERROR', 'REQUEST_TIMEOUT'])(
    'preserves media during %s without requesting another token',
    async (code) => {
      const user = userEvent.setup()
      view()
      await user.click(
        await screen.findByRole('button', { name: 'Tham gia phiên tư vấn' }),
      )
      await screen.findByText('SDK connected')
      api.session.mockRejectedValueOnce(
        new ApiError({ code, message: 'private transport detail' }),
      )
      await user.click(screen.getByRole('button', { name: 'Tải lại phiên' }))
      expect(screen.getByText('SDK connected')).toBeInTheDocument()
      expect(api.access).toHaveBeenCalledOnce()
    },
  )
  it('stops on malformed authority instead of treating it as temporary network loss', async () => {
    const user = userEvent.setup()
    view()
    await user.click(
      await screen.findByRole('button', { name: 'Tham gia phiên tư vấn' }),
    )
    await screen.findByText('SDK connected')
    api.session.mockRejectedValueOnce(new Error('Video session unavailable.'))
    await user.click(screen.getByRole('button', { name: 'Tải lại phiên' }))
    expect(screen.queryByText('SDK connected')).not.toBeInTheDocument()
  })
  it('enforces the original monotonic deadline immediately when a suspended tab resumes', async () => {
    const user = userEvent.setup()
    let time = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => time)
    view()
    await user.click(
      await screen.findByRole('button', { name: 'Tham gia phiên tư vấn' }),
    )
    await screen.findByText('SDK connected')
    time += 3_600_000
    act(() => window.dispatchEvent(new Event('focus')))
    expect(screen.queryByText('SDK connected')).not.toBeInTheDocument()
    expect(api.complete).not.toHaveBeenCalled()
  })
  it('does not resurrect a late access response after page departure', async () => {
    const user = userEvent.setup()
    let deliver!: (value: unknown) => void
    api.access.mockReturnValue(
      new Promise((resolve) => {
        deliver = resolve
      }),
    )
    view()
    await user.click(
      await screen.findByRole('button', { name: 'Tham gia phiên tư vấn' }),
    )
    act(() => window.dispatchEvent(new Event('pagehide')))
    await act(async () => deliver(issued))
    expect(screen.queryByText('SDK connected')).not.toBeInTheDocument()
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
