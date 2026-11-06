import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MamDockSlot } from '@/features/mam/MamDockSlot'
import { setMamHidden, setMamMotionOff } from '@/features/mam/mam-preferences'
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

// MB-815: the real character needs a canvas and WASM; the dialog only drives its props.
vi.mock('@/features/mam/MamCharacter', () => ({
  MamCharacter: (props: {
    size: number
    behavior?: string
    reducedMotion?: boolean
  }) => (
    <span
      data-testid="mam-character"
      data-behavior={props.behavior}
      data-size={props.size}
      data-reduced={String(props.reducedMotion)}
    />
  ),
}))

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
  const dialog = (open: boolean) => (
    <VoiceDialog
      open={open}
      onOpenChange={close}
      createController={() => controller}
      conversation={conversation}
    />
  )
  const view = render(dialog(true))
  return {
    api,
    media,
    controller,
    current,
    close,
    events: () => events,
    rerender: (open: boolean) => view.rerender(dialog(open)),
  }
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
    expect(
      await screen.findByText(
        'Tự kết thúc sau 60 giây không có lời nói được nhận diện.',
      ),
    ).toBeVisible()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Bắt đầu cuộc gọi' }),
    )
    await waitFor(() => expect(f.media.connect).toHaveBeenCalled())
    expect(
      screen.getByText(
        'Tự kết thúc sau 60 giây không có lời nói được nhận diện.',
      ),
    ).toBeVisible()
    act(() => f.events()?.hint('thinking'))
    expect(screen.getByRole('status')).toHaveTextContent('AI đang nghĩ')
    expect(
      screen.getByRole('link', { name: 'Cần trợ giúp ngay' }),
    ).toBeVisible()
    const mute = screen.getByRole('button', { name: 'Tắt micro' })
    expect(mute).toHaveAttribute('title', 'Tắt micro')
    expect(mute.textContent).toBe('')
    expect(mute.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(mute)
    expect(
      await screen.findByRole('button', { name: 'Bật micro' }),
    ).toHaveAttribute('aria-pressed', 'true')
    act(() => f.events()?.reconnecting())
    expect(screen.getByRole('status')).toHaveTextContent('Đang kết nối lại')
    const end = screen.getByRole('button', { name: 'Kết thúc' })
    expect(end).toHaveAttribute('title', 'Kết thúc')
    expect(end.textContent).toBe('')
    fireEvent.click(end)
    expect(await screen.findByText('Đã kết thúc')).toBeVisible()
    expect(f.media.close).toHaveBeenCalled()
    expect(f.api.end).toHaveBeenCalled()
  })
  it('keeps the icon-only audio recovery control named and actionable', async () => {
    const f = fixture()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Bắt đầu cuộc gọi' }),
    )
    await waitFor(() => expect(f.media.connect).toHaveBeenCalled())
    act(() => f.events()?.audioBlocked())
    const audio = screen.getByRole('button', { name: 'Bật âm thanh' })
    expect(audio).toHaveAttribute('title', 'Bật âm thanh')
    expect(audio.textContent).toBe('')
    fireEvent.click(audio)
    await waitFor(() => expect(f.media.audio).toHaveBeenCalledOnce())
    await act(async () => f.controller.end())
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

describe('Mầm in the AI voice call', () => {
  afterEach(() => window.localStorage.clear())
  const character = () => screen.queryByTestId('mam-character')
  const stage = () => document.querySelector('[data-mam-behavior]')
  const badge = () => document.querySelector('[class*="micBadge"]')
  const status = () => screen.getByRole('status')
  function matchMedia(os = false, compact = false) {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduced-motion') ? os : compact,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  }
  async function call(patch: Partial<VoiceSession> = {}, slotted = true) {
    matchMedia()
    if (slotted) render(<MamDockSlot />)
    const f = fixture(eligibility(), patch)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Bắt đầu cuộc gọi' }),
    )
    await waitFor(() => expect(f.media.connect).toHaveBeenCalled())
    return f
  }
  const expectMam = (behavior: string, text: string) => {
    expect(character()).toHaveAttribute('data-behavior', behavior)
    expect(stage()).toHaveAttribute('data-mam-behavior', behavior)
    expect(status()).toHaveTextContent(text)
  }

  it('keeps the Sparkles mark while the eligibility check loads', () => {
    matchMedia()
    render(<MamDockSlot />)
    fixture()
    expect(screen.getByText('Đang kiểm tra quyền gọi AI…')).toBeVisible()
    expect(character()).toBeNull()
  })

  it('stays idle and says preparing, whatever the agent hint says', async () => {
    const f = await call({ state: 'CONNECTING' })
    for (const hint of ['speaking', 'thinking', 'listening'] as const) {
      act(() => f.events()?.hint(hint))
      expectMam('idle', 'Đang chuẩn bị cuộc gọi')
    }
    await act(async () => f.controller.end())
  })

  it.each([
    ['listening', 'idle', 'Mầm đang lắng nghe'],
    ['thinking', 'thinking', 'Mầm đang nghĩ'],
    ['speaking', 'speaking', 'Mầm đang nói'],
    ['idle', 'idle', 'Đang chờ Mầm'],
    ['initializing', 'idle', 'Đang chờ Mầm'],
    ['unavailable', 'idle', 'Đang chờ Mầm'],
  ] as const)(
    'maps hint %s to %s with "%s" and no dim',
    async (hint, behavior, text) => {
      const f = await call()
      act(() => f.events()?.hint(hint))
      expectMam(behavior, text)
      expect(stage()).toHaveAttribute('data-dim', 'false')
      expect(badge()).toBeNull()
      await act(async () => f.controller.end())
    },
  )

  it('unmounts Mầm when a retained dialog closes mid-call (R1-1)', async () => {
    const f = await call()
    act(() => f.events()?.hint('speaking'))
    expect(character()).toHaveAttribute('data-behavior', 'speaking')
    fireEvent.click(
      screen.getByRole('button', { name: 'Đóng và kết thúc cuộc gọi' }),
    )
    expect(f.close).toHaveBeenCalledWith(false)
    // The parent keeps the dialog mounted with open=false, as VoiceEntry does.
    f.rerender(false)
    expect(character()).toBeNull()
  })

  it('unmounts Mầm when the call ends normally', async () => {
    const f = await call()
    act(() => f.events()?.hint('speaking'))
    await act(async () => f.controller.end())
    expect(character()).toBeNull()
  })

  it('names Mầm in the helper copy too, never mixing AI and Mầm', async () => {
    const f = await call()
    act(() => f.events()?.hint('speaking'))
    expect(
      screen.getByText('Vui lòng chờ Mầm sẵn sàng trước khi nói.'),
    ).toBeInTheDocument()
    act(() => f.events()?.hint('unavailable'))
    expect(
      screen.getByText(/Chưa nhận được trạng thái mới từ Mầm\./),
    ).toBeInTheDocument()
    await act(async () => f.controller.end())
  })

  it('dims only while reconnecting, as idle', async () => {
    const f = await call()
    act(() => f.events()?.hint('speaking'))
    act(() => f.events()?.reconnecting())
    expectMam('idle', 'Đang kết nối lại')
    expect(stage()).toHaveAttribute('data-dim', 'true')
    await act(async () => f.controller.end())
  })

  it('is idle while ending', async () => {
    const f = await call()
    act(() => f.events()?.hint('speaking'))
    let confirm: (value: VoiceSession) => void = () => undefined
    f.api.end.mockReturnValue(
      new Promise<VoiceSession>((resolve) => (confirm = resolve)),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Kết thúc' }))
    await screen.findByText('Đang xác nhận kết thúc')
    expectMam('idle', 'Đang xác nhận kết thúc')
    await act(async () => confirm(session({ ...f.current, state: 'ENDED' })))
  })

  it.each([
    ['speaking', 'speaking'],
    ['listening', 'idle'],
  ] as const)(
    'keeps following the hint when muted while %s, with a badge',
    async (hint, behavior) => {
      const f = await call()
      act(() => f.events()?.hint(hint))
      fireEvent.click(screen.getByRole('button', { name: 'Tắt micro' }))
      await screen.findByRole('button', { name: 'Bật micro' })
      expectMam(behavior, 'Micro đang tắt')
      expect(badge()).toHaveAttribute('aria-hidden', 'true')
      await act(async () => f.controller.end())
    },
  )

  it('marks the character as decoration and keeps one live region', async () => {
    const f = await call()
    expect(character()?.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1)
    await act(async () => f.controller.end())
  })

  it.each([
    ['the flag is off', false, () => undefined],
    ['the user hid Mầm', true, () => setMamHidden(true)],
  ])(
    'keeps the Sparkles mark and "AI" strings when %s',
    async (_case, slotted, arrange) => {
      arrange()
      const f = await call({}, slotted)
      act(() => f.events()?.hint('thinking'))
      expect(character()).toBeNull()
      expect(stage()).toBeNull()
      expect(status()).toHaveTextContent('AI đang nghĩ')
      act(() => f.events()?.hint('unavailable'))
      expect(status()).toHaveTextContent('Đang chờ AI')
      fireEvent.click(screen.getByRole('button', { name: 'Tắt micro' }))
      await screen.findByRole('button', { name: 'Bật micro' })
      expect(badge()).toBeNull()
      await act(async () => f.controller.end())
    },
  )

  it.each([
    ['motion is full', () => undefined, false, 'false'],
    ['the user reduced motion', () => setMamMotionOff(true), false, 'true'],
    ['the OS reduces motion', () => undefined, true, 'true'],
  ])('passes reducedMotion when %s', async (_case, arrange, os, expected) => {
    arrange()
    render(<MamDockSlot />)
    matchMedia(os)
    const f = fixture()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Bắt đầu cuộc gọi' }),
    )
    await waitFor(() => expect(f.media.connect).toHaveBeenCalled())
    expect(character()).toHaveAttribute('data-reduced', expected)
    expect(stage()).toHaveAttribute('data-reduced', expected)
    await act(async () => f.controller.end())
  })

  it.each([
    [false, '164'],
    [true, '116'],
  ])(
    'sizes the character by breakpoint (compact %s)',
    async (compact, size) => {
      render(<MamDockSlot />)
      matchMedia(false, compact)
      const f = fixture()
      fireEvent.click(
        await screen.findByRole('button', { name: 'Bắt đầu cuộc gọi' }),
      )
      await waitFor(() => expect(f.media.connect).toHaveBeenCalled())
      expect(character()).toHaveAttribute('data-size', size)
      await act(async () => f.controller.end())
    },
  )
})
