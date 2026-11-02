import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  connection,
  disclosure,
  eligibility,
  session,
} from '@/tests/fixtures/voice'
import { VoiceController } from './controller'
import { voiceClient } from './client'
import type { Media, MediaEvents } from './media'
import type { VoiceSession } from './contract'
import VoiceDialog from './VoiceDialog'

function fixture(
  value = eligibility(),
  patch: Partial<VoiceSession> = {},
  conversation?: { conversationId: string; title: string },
) {
  const bound = connection()
  const current = session({ hardStopAt: bound.hardStopAt, ...patch })
  const api = {
    eligibility: vi.fn().mockResolvedValue(value),
    disclosure: vi.fn(),
    consent: vi.fn(),
    contextHandoff: vi.fn(),
    create: vi.fn().mockResolvedValue(current),
    connection: vi.fn().mockResolvedValue(bound),
    session: vi.fn().mockResolvedValue(current),
    end: vi
      .fn()
      .mockResolvedValue(
        session({ ...current, state: 'ENDED', terminalReason: 'USER_ENDED' }),
      ),
  }
  let events: MediaEvents | undefined
  const media: Media = {
    permission: vi.fn().mockResolvedValue(undefined),
    connect: vi.fn().mockImplementation((_connection, next: MediaEvents) => {
      events = next
      return Promise.resolve()
    }),
    mute: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    audio: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  }
  const controller = new VoiceController(api, () => media)
  const close = vi.fn()
  render(
    <VoiceDialog
      open
      onOpenChange={close}
      createController={() => controller}
      conversation={conversation}
    />,
  )
  return { api, media, controller, current, close, events: () => events }
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe('accessible AI Voice dialog', () => {
  const selectedConversation = {
    conversationId: '33333333-3333-4333-8333-333333333333',
    title: 'Cuộc trò chuyện được chọn',
  }
  it('leaves Text continuity unchecked and starts voice-only until explicitly selected', async () => {
    const f = fixture(
      eligibility('PLUS', { textContextHandoffEnabled: true }),
      {},
      selectedConversation,
    )
    expect(await screen.findByRole('checkbox')).not.toBeChecked()
    expect(f.api.contextHandoff).not.toHaveBeenCalled()
    expect(f.media.permission).not.toHaveBeenCalled()
    expect(f.api.create).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu cuộc gọi' }))
    expect(
      await screen.findByText('Cuộc gọi không dùng tin nhắn trước đó.'),
    ).toBeVisible()
    expect(f.api.contextHandoff).not.toHaveBeenCalled()
    expect(f.api.create).toHaveBeenCalledWith(expect.any(String))
    await act(async () => f.controller.end())
  })
  it('waits for the selected-chat ticket and authoritative attachment before claiming continuity', async () => {
    const f = fixture(
      eligibility('PLUS', { textContextHandoffEnabled: true }),
      { contextMode: 'TEXT_HANDOFF' },
      selectedConversation,
    )
    let release:
      | ((value: {
          handoffToken: string
          expiresAt: string
          selectedPairs: number
          policyVersion: string
        }) => void)
      | undefined
    f.api.contextHandoff.mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      }),
    )
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(
      screen.getByRole('button', { name: 'Tiếp tục bằng giọng nói' }),
    )
    await waitFor(() =>
      expect(f.api.contextHandoff).toHaveBeenCalledWith(
        selectedConversation.conversationId,
      ),
    )
    expect(f.media.permission).not.toHaveBeenCalled()
    expect(f.api.create).not.toHaveBeenCalled()
    expect(
      screen.queryByText('Đã chuẩn bị bối cảnh từ cuộc trò chuyện bạn chọn.'),
    ).not.toBeInTheDocument()
    await act(async () => {
      release?.({
        handoffToken: 'synthetic-ticket'.repeat(4),
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        selectedPairs: 1,
        policyVersion: 'text-voice-handoff-v1',
      })
    })
    expect(
      await screen.findByText(
        'Đã chuẩn bị bối cảnh từ cuộc trò chuyện bạn chọn.',
      ),
    ).toBeVisible()
    expect(f.api.create).toHaveBeenCalledWith(expect.any(String), {
      handoffToken: 'synthetic-ticket'.repeat(4),
    })
    expect(f.api.create).toHaveBeenCalledTimes(1)
    await act(async () => f.controller.end())
  })
  it('requires a new explicit voice-only choice after handoff denial before opening the microphone', async () => {
    const f = fixture(
      eligibility('PLUS', { textContextHandoffEnabled: true }),
      {},
      selectedConversation,
    )
    f.api.contextHandoff.mockRejectedValue(new Error('synthetic denial'))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(
      screen.getByRole('button', { name: 'Tiếp tục bằng giọng nói' }),
    )
    const withoutText = await screen.findByRole('button', {
      name: 'Gọi không dùng tin nhắn',
    })
    expect(f.media.permission).not.toHaveBeenCalled()
    expect(f.api.create).not.toHaveBeenCalled()
    fireEvent.click(withoutText)
    expect(
      await screen.findByText('Cuộc gọi không dùng tin nhắn trước đó.'),
    ).toBeVisible()
    expect(f.api.contextHandoff).toHaveBeenCalledTimes(1)
    expect(f.api.create).toHaveBeenCalledWith(expect.any(String))
    await act(async () => f.controller.end())
  })
  it('presents FREE as a locked preview and leaves text continuation available', async () => {
    const f = fixture(eligibility('FREE'))
    expect(
      await screen.findByText('Bản xem trước · Chưa kết nối micro'),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Xem gói Plus / Premium' }),
    ).toHaveAttribute('href', '/subscription')
    expect(
      screen.getByRole('link', { name: 'Cần trợ giúp ngay' }),
    ).toHaveAttribute('href', '/safety-directory')
    expect(f.media.permission).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục nhắn tin' }))
    expect(f.close).toHaveBeenCalledWith(false)
  })
  it.each(['PLUS', 'PREMIUM'] as const)(
    'uses %s server duration rather than hardcoding a package allowance',
    async (plan) => {
      const f = fixture(eligibility(plan, { availableSessionSeconds: 120 }))
      expect(await screen.findByText('Tối đa 2 phút')).toBeVisible()
      expect(
        screen.getByText(
          new RegExp(
            `Trần mỗi phiên của gói: ${plan === 'PLUS' ? 5 : 10} phút`,
          ),
        ),
      ).toBeVisible()
      expect(f.api.create).not.toHaveBeenCalled()
      expect(f.media.permission).not.toHaveBeenCalled()
    },
  )
  it('shows missing entitlement as unavailable without inventing FREE or a positive call preview', async () => {
    fixture(
      eligibility('PLUS', {
        state: 'ENTITLEMENT_UNAVAILABLE',
        eligible: false,
        availableSessionSeconds: 0,
      }),
    )
    expect(
      await screen.findByText(/Chưa thể xác minh quyền gọi AI/),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Bắt đầu cuộc gọi' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Xem gói Plus / Premium' }),
    ).not.toBeInTheDocument()
  })
  it('requires independent Voice disclosure acceptance and rechecks eligibility without starting a call', async () => {
    const f = fixture(
      eligibility('PLUS', {
        state: 'VOICE_CONSENT_REQUIRED',
        eligible: false,
        availableSessionSeconds: 0,
      }),
    )
    vi.spyOn(voiceClient, 'disclosure').mockResolvedValue(disclosure)
    const grant = vi.spyOn(voiceClient, 'consent').mockResolvedValue({
      consentType: 'AI_VOICE_PROCESSING',
      consentVersion: disclosure.consentVersion,
      current: true,
      granted: true,
      acceptedAt: new Date().toISOString(),
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Xem thông tin và đồng ý' }),
    )
    const agree = await screen.findByRole('button', {
      name: 'Đồng ý và tiếp tục',
    })
    expect(agree).toBeDisabled()
    expect(screen.getByText(disclosure.disclosureText)).toBeVisible()
    fireEvent.click(screen.getByRole('checkbox'))
    f.api.eligibility.mockResolvedValue(eligibility())
    fireEvent.click(agree)
    expect(
      await screen.findByRole('button', { name: 'Bắt đầu cuộc gọi' }),
    ).toBeVisible()
    expect(grant).toHaveBeenCalledWith(
      { consentVersion: disclosure.consentVersion, granted: true },
      expect.any(String),
    )
    expect(f.api.create).not.toHaveBeenCalled()
    expect(f.media.permission).not.toHaveBeenCalled()
  })
  it('requires existing AI consent separately and does not treat it as Voice consent', async () => {
    const f = fixture(
      eligibility('PLUS', {
        state: 'CONSENT_REQUIRED',
        eligible: false,
        availableSessionSeconds: 0,
      }),
    )
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          consentType: 'AI_PROCESSING',
          version: 'ai-processing-capstone-v2',
          locale: 'vi-VN',
          title: 'Đồng ý AI',
          content: 'Thông tin xử lý AI hiện hành.',
          capstoneOnly: true,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          decisionId: connection().voiceSessionId,
          consentType: 'AI_PROCESSING',
          policyVersion: 'ai-processing-capstone-v2',
          granted: true,
          decidedAt: new Date().toISOString(),
        }),
      )
    vi.stubGlobal('fetch', fetch)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Xem thông tin và đồng ý' }),
    )
    expect(
      await screen.findByText('Thông tin xử lý AI hiện hành.'),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('checkbox'))
    f.api.eligibility.mockResolvedValue(
      eligibility('PLUS', {
        state: 'VOICE_CONSENT_REQUIRED',
        eligible: false,
        availableSessionSeconds: 0,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý và tiếp tục' }))
    expect(
      await screen.findByText(
        /thông tin xử lý giọng nói trước cuộc gọi đầu tiên/,
      ),
    ).toBeVisible()
    expect(f.api.create).not.toHaveBeenCalled()
  })
  it('renders microphone denial and never admits a call', async () => {
    const f = fixture()
    vi.mocked(f.media.permission).mockRejectedValueOnce(
      new DOMException('Synthetic denial', 'NotAllowedError'),
    )
    fireEvent.click(
      await screen.findByRole('button', { name: 'Bắt đầu cuộc gọi' }),
    )
    expect(await screen.findByText(/Micro chưa được cho phép/)).toBeVisible()
    expect(f.api.create).not.toHaveBeenCalled()
  })
  it('announces media states, keeps safety visible, mutes and ends with server confirmation', async () => {
    const f = fixture()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Bắt đầu cuộc gọi' }),
    )
    await waitFor(() => expect(f.media.connect).toHaveBeenCalled())
    act(() => f.events()?.hint('thinking'))
    expect(screen.getByRole('status')).toHaveTextContent('AI đang nghĩ')
    expect(
      screen.getByRole('link', { name: 'Cần trợ giúp ngay' }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Tắt micro' }))
    expect(
      await screen.findByRole('button', { name: 'Bật micro' }),
    ).toHaveAttribute('aria-pressed', 'true')
    act(() => f.events()?.reconnecting())
    expect(screen.getByRole('status')).toHaveTextContent('Đang kết nối lại')
    fireEvent.click(screen.getByRole('button', { name: 'Kết thúc' }))
    expect(await screen.findByText('Đã kết thúc')).toBeVisible()
    expect(f.media.close).toHaveBeenCalled()
    expect(f.api.end).toHaveBeenCalled()
  })
  it.each(['agent-first', 'session-first'])(
    'invites speech only after both active session and fresh listening hint, %s',
    async (order) => {
      vi.useFakeTimers()
      const f = fixture(eligibility(), { state: 'CONNECTING' })
      await act(async () => {
        await f.controller.start()
      })
      expect(f.controller.snapshot().phase).toBe('connected')
      expect(screen.getByRole('status')).toHaveTextContent(
        'Đang chuẩn bị cuộc gọi',
      )
      expect(
        screen.queryByText('Chia sẻ khi bạn sẵn sàng.'),
      ).not.toBeInTheDocument()
      if (order === 'agent-first') act(() => f.events()?.hint('listening'))
      expect(screen.getByRole('status')).toHaveTextContent(
        'Đang chuẩn bị cuộc gọi',
      )
      f.api.session.mockResolvedValue(
        session({ ...f.current, state: 'ACTIVE' }),
      )
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      if (order === 'session-first') {
        expect(screen.getByRole('status')).toHaveTextContent('Đang chờ AI')
        expect(
          screen.queryByText('Chia sẻ khi bạn sẵn sàng.'),
        ).not.toBeInTheDocument()
        act(() => f.events()?.hint('listening'))
      }
      expect(screen.getByRole('status')).toHaveTextContent('AI đang lắng nghe')
      expect(screen.getByText('Chia sẻ khi bạn sẵn sàng.')).toBeVisible()
      act(() => f.events()?.hint('unavailable'))
      expect(
        screen.queryByText('Chia sẻ khi bạn sẵn sàng.'),
      ).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Đang chờ AI')
      expect(f.api.create).toHaveBeenCalledTimes(1)
      await act(async () => {
        await f.controller.end()
      })
    },
  )
  it('works through React strict subscription setup and never opens a microphone automatically', async () => {
    const api = {
      ...voiceClient,
      eligibility: vi.fn().mockResolvedValue(eligibility()),
    }
    const controller = new VoiceController(api)
    render(
      <StrictMode>
        <VoiceDialog
          open
          onOpenChange={vi.fn()}
          createController={() => controller}
        />
      </StrictMode>,
    )
    expect(
      await screen.findByRole('button', { name: 'Bắt đầu cuộc gọi' }),
    ).toBeVisible()
    expect(controller.snapshot().phase).toBe('ready')
  })
})
