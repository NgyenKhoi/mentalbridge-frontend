import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import type { CompanionConversation } from '@/lib/companion/companion-contract'
import {
  CompanionBrowserError,
  companionBrowserClient,
} from '../api/browser-client'
import AiCompanionChat from './AiCompanionChat'

vi.mock('@/features/resources/api/browser-resources', () => ({
  getResourceCatalogue: vi
    .fn()
    .mockResolvedValue({ items: [], hasMore: false }),
}))
vi.mock('@/features/resources/api/browser-resource-progress', () => ({
  getResourceProgress: vi.fn().mockResolvedValue([]),
}))

vi.mock('../api/browser-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/browser-client')>()
  return {
    ...actual,
    companionBrowserClient: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      send: vi.fn(),
      updateContext: vi.fn(),
      remove: vi.fn(),
    },
  }
})

const accountId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const draftKey = `mb.companion.draft.${accountId}.11111111-1111-4111-8111-111111111111`

const conversation: CompanionConversation = {
  conversationId: '11111111-1111-4111-8111-111111111111',
  title: 'Cuộc trò chuyện mới',
  context: {
    sources: {
      plan: true,
      diary: false,
      screening: false,
      resourceIds: [],
    },
    updatedAt: '2026-09-20T08:00:00Z',
  },
  messages: [],
  createdAt: '2026-09-20T08:00:00Z',
  updatedAt: '2026-09-20T08:00:00Z',
  expiresAt: '2026-12-19T08:00:00Z',
}

const journalPage = {
  items: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      ownerAccountId: '33333333-3333-4333-8333-333333333333',
      currentRevision: 1,
      occurredAt: '2026-09-20T07:00:00Z',
      createdAt: '2026-09-20T07:00:00Z',
      updatedAt: '2026-09-20T07:00:00Z',
      deleted: false,
      tags: [],
      mood: 'GOOD',
      encryption: {
        algorithm: 'AES-256-GCM',
        keyId: 'single-key',
        encryptedAt: '2026-09-20T07:00:00Z',
      },
      analysisState: 'not_requested',
      content: { preview: 'Một ngày bình tĩnh hơn', byteLength: 24 },
    },
  ],
  page: { limit: 20, hasMore: false },
}

describe('AiCompanionChat', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.sessionStorage.clear()
    vi.mocked(companionBrowserClient.list).mockResolvedValue({
      items: [conversation],
    })
    vi.mocked(companionBrowserClient.get).mockResolvedValue(conversation)
    vi.mocked(companionBrowserClient.create).mockResolvedValue(conversation)
    vi.mocked(companionBrowserClient.updateContext).mockResolvedValue(
      conversation,
    )
    vi.mocked(companionBrowserClient.remove).mockResolvedValue()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(journalPage), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
  })

  it('persists context per conversation and sends only the message', async () => {
    const answered: CompanionConversation = {
      ...conversation,
      messages: [
        {
          messageId: '44444444-4444-4444-8444-444444444444',
          role: 'USER',
          content: 'Mình nên bắt đầu từ đâu?',
          createdAt: '2026-09-20T08:01:00Z',
          contextKinds: [],
        },
        {
          messageId: '55555555-5555-4555-8555-555555555555',
          role: 'ASSISTANT',
          content: 'Hãy chọn một bước nhỏ.',
          createdAt: '2026-09-20T08:01:00Z',
          contextKinds: ['JOURNAL', 'SUPPORT_PLAN'],
        },
      ],
    }
    vi.mocked(companionBrowserClient.get)
      .mockResolvedValueOnce(conversation)
      .mockResolvedValueOnce(answered)
    vi.mocked(companionBrowserClient.send).mockResolvedValue({
      conversationId: conversation.conversationId,
      userMessageId: answered.messages[0]!.messageId,
      assistantMessageId: answered.messages[1]!.messageId,
      assistant: answered.messages[1]!.content,
      createdAt: answered.messages[1]!.createdAt,
      contextKinds: ['JOURNAL', 'SUPPORT_PLAN'],
      quota: {
        plan: 'FREE',
        policyVersion: 'companion-quota-v1',
        remaining: 4,
        resetAt: '2026-09-20T17:00:00Z',
        limitDisplayed: true,
      },
    })
    vi.mocked(companionBrowserClient.updateContext).mockResolvedValue({
      ...conversation,
      context: {
        ...conversation.context,
        sources: { ...conversation.context.sources, diary: true },
      },
    })
    const user = userEvent.setup()
    render(<AiCompanionChat accountId={accountId} />)

    await user.click(
      await screen.findByRole('button', { name: /Mở nguồn ngữ cảnh/ }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Nguồn thông tin cho cuộc trò chuyện này',
    })
    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Bật Nhật ký' }),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }))
    await waitFor(() =>
      expect(companionBrowserClient.updateContext).toHaveBeenCalledWith(
        conversation.conversationId,
        {
          sources: {
            plan: true,
            diary: true,
            screening: false,
            resourceIds: [],
          },
        },
      ),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Tin nhắn' }),
      'Mình nên bắt đầu từ đâu?',
    )
    await user.click(screen.getByRole('button', { name: 'Gửi' }))

    await waitFor(() =>
      expect(companionBrowserClient.send).toHaveBeenCalledWith(
        conversation.conversationId,
        { message: 'Mình nên bắt đầu từ đâu?' },
        expect.any(String),
        expect.any(AbortSignal),
      ),
    )
    expect(
      await within(
        screen.getByRole('region', { name: 'AI Companion' }),
      ).findByText('Hãy chọn một bước nhỏ.'),
    ).toBeVisible()
    expect(screen.getByText(/Còn 4 lượt/)).toBeVisible()
    await user.click(screen.getByText('Đã dùng 2 nguồn'))
    expect(screen.getByText('Nhật ký gần đây')).toBeVisible()
    expect(screen.getByText('Kế hoạch hỗ trợ hiện tại')).toBeVisible()
  })

  it('shows consent withdrawal separately and retains the draft for retry', async () => {
    vi.mocked(companionBrowserClient.send).mockRejectedValue(
      new CompanionBrowserError('denied', 'AI_CONSENT_REQUIRED', 403),
    )
    const user = userEvent.setup()
    render(<AiCompanionChat accountId={accountId} />)
    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await user.type(composer, 'Nội dung cần giữ lại')
    await user.click(screen.getByRole('button', { name: 'Gửi' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /tắt hoặc chưa cấp đồng ý xử lý AI/,
    )
    expect(composer).toHaveValue('Nội dung cần giữ lại')
  })

  it('explains Premium limits truthfully and permanently deletes on confirmation', async () => {
    vi.mocked(companionBrowserClient.send).mockResolvedValue({
      conversationId: conversation.conversationId,
      userMessageId: '44444444-4444-4444-8444-444444444444',
      assistantMessageId: '55555555-5555-4555-8555-555555555555',
      assistant: 'Đã hiểu.',
      createdAt: '2026-09-20T08:01:00Z',
      contextKinds: [],
      quota: {
        plan: 'PREMIUM',
        policyVersion: 'companion-quota-v1',
        remaining: null,
        resetAt: '2026-09-20T17:00:00Z',
        limitDisplayed: false,
      },
    })
    vi.mocked(companionBrowserClient.get)
      .mockResolvedValueOnce(conversation)
      .mockResolvedValueOnce(conversation)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<AiCompanionChat accountId={accountId} />)
    await user.type(
      await screen.findByRole('textbox', { name: 'Tin nhắn' }),
      'Xin chào',
    )
    await user.click(screen.getByRole('button', { name: 'Gửi' }))
    expect(
      await screen.findByText(/Premium không hiển thị giới hạn/),
    ).toBeVisible()
    await user.click(
      screen.getByRole('button', { name: 'Xóa cuộc trò chuyện' }),
    )
    await waitFor(() =>
      expect(companionBrowserClient.remove).toHaveBeenCalledWith(
        conversation.conversationId,
      ),
    )
    expect(screen.getByText('Bắt đầu khi bạn sẵn sàng')).toBeVisible()
  })

  it('uses a fresh key when retrying an unchanged draft after terminal provider failure', async () => {
    vi.mocked(companionBrowserClient.send)
      .mockRejectedValueOnce(
        new CompanionBrowserError(
          'provider failed',
          'CHAT_PROVIDER_UNAVAILABLE',
          503,
        ),
      )
      .mockResolvedValueOnce({
        conversationId: conversation.conversationId,
        userMessageId: '44444444-4444-4444-8444-444444444444',
        assistantMessageId: '55555555-5555-4555-8555-555555555555',
        assistant: 'Mình đang lắng nghe.',
        createdAt: '2026-09-20T08:01:00Z',
        contextKinds: [],
        quota: {
          plan: 'FREE',
          policyVersion: 'companion-quota-v1',
          remaining: 4,
          resetAt: '2026-09-20T17:00:00Z',
          limitDisplayed: true,
        },
      })
    const user = userEvent.setup()
    render(<AiCompanionChat accountId={accountId} />)
    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await user.type(composer, 'Giữ nguyên bản nháp')

    await user.click(screen.getByRole('button', { name: 'Gửi' }))
    await screen.findByRole('alert')
    const listCalls = vi.mocked(companionBrowserClient.list).mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Gửi lại' }))

    await waitFor(() =>
      expect(companionBrowserClient.send).toHaveBeenCalledTimes(2),
    )
    expect(vi.mocked(companionBrowserClient.send).mock.calls[0]?.[2]).not.toBe(
      vi.mocked(companionBrowserClient.send).mock.calls[1]?.[2],
    )
    expect(companionBrowserClient.list).toHaveBeenCalledTimes(listCalls)
    await waitFor(() => expect(composer).toHaveValue(''))
  })

  it('retains the key while an unchanged request is still in progress', async () => {
    vi.mocked(companionBrowserClient.send)
      .mockRejectedValueOnce(
        new CompanionBrowserError(
          'in progress',
          'CHAT_REQUEST_IN_PROGRESS',
          409,
        ),
      )
      .mockResolvedValueOnce({
        conversationId: conversation.conversationId,
        userMessageId: '44444444-4444-4444-8444-444444444444',
        assistantMessageId: '55555555-5555-4555-8555-555555555555',
        assistant: 'Mình đang lắng nghe.',
        createdAt: '2026-09-20T08:01:00Z',
        contextKinds: [],
        quota: {
          plan: 'FREE',
          policyVersion: 'companion-quota-v1',
          remaining: 4,
          resetAt: '2026-09-20T17:00:00Z',
          limitDisplayed: true,
        },
      })
    const user = userEvent.setup()
    render(<AiCompanionChat accountId={accountId} />)
    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await user.type(composer, 'Giữ cùng khóa gửi')

    await user.click(screen.getByRole('button', { name: 'Gửi' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Gửi lại' }))

    await waitFor(() =>
      expect(companionBrowserClient.send).toHaveBeenCalledTimes(2),
    )
    expect(vi.mocked(companionBrowserClient.send).mock.calls[0]?.[2]).toBe(
      vi.mocked(companionBrowserClient.send).mock.calls[1]?.[2],
    )
  })

  it('warns before switching and restores each conversation draft', async () => {
    const otherConversation: CompanionConversation = {
      ...conversation,
      conversationId: '66666666-6666-4666-8666-666666666666',
      title: 'Giấc ngủ gần đây',
      createdAt: '2026-09-20T09:00:00Z',
      updatedAt: '2026-09-20T09:00:00Z',
    }
    vi.mocked(companionBrowserClient.list).mockResolvedValue({
      items: [conversation, otherConversation],
    })
    vi.mocked(companionBrowserClient.get).mockImplementation(async (id) =>
      id === otherConversation.conversationId
        ? otherConversation
        : conversation,
    )
    const user = userEvent.setup()
    render(
      <FeedbackProvider>
        <AiCompanionChat accountId={accountId} />
      </FeedbackProvider>,
    )

    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await user.type(composer, 'Bản nháp cần giữ lại')
    await user.click(screen.getByRole('button', { name: /Giấc ngủ gần đây/ }))
    expect(
      await screen.findByRole('heading', {
        name: 'Bạn còn một tin nhắn chưa gửi',
      }),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Chuyển hội thoại' }))
    await waitFor(() => expect(composer).toHaveValue(''))

    await user.click(
      screen.getByRole('button', {
        name: /Cuộc trò chuyện mới.*Tiếp tục cuộc trò chuyện/,
      }),
    )
    await waitFor(() => expect(composer).toHaveValue('Bản nháp cần giữ lại'))
  })

  it('commits a successful send without a redundant detail refresh', async () => {
    const answered: CompanionConversation = {
      ...conversation,
      messages: [
        {
          messageId: '44444444-4444-4444-8444-444444444444',
          role: 'USER',
          content: 'Chỉ gửi một lần',
          createdAt: '2026-09-20T08:01:00Z',
          contextKinds: [],
        },
        {
          messageId: '55555555-5555-4555-8555-555555555555',
          role: 'ASSISTANT',
          content: 'Mình đã nhận được tin nhắn.',
          createdAt: '2026-09-20T08:01:00Z',
          contextKinds: [],
        },
      ],
      updatedAt: '2026-09-20T08:01:00Z',
    }
    vi.mocked(companionBrowserClient.get).mockResolvedValueOnce(conversation)
    vi.mocked(companionBrowserClient.send).mockResolvedValue({
      conversationId: conversation.conversationId,
      userMessageId: answered.messages[0]!.messageId,
      assistantMessageId: answered.messages[1]!.messageId,
      assistant: answered.messages[1]!.content,
      createdAt: answered.messages[1]!.createdAt,
      contextKinds: [],
      quota: {
        plan: 'FREE',
        policyVersion: 'companion-quota-v1',
        remaining: 4,
        resetAt: '2026-09-20T17:00:00Z',
        limitDisplayed: true,
      },
    })
    const user = userEvent.setup()
    render(<AiCompanionChat accountId={accountId} />)
    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await user.type(composer, 'Chỉ gửi một lần')

    await user.click(screen.getByRole('button', { name: 'Gửi' }))

    await waitFor(() => {
      expect(
        within(screen.getByRole('region', { name: 'AI Companion' })).getByText(
          'Mình đã nhận được tin nhắn.',
        ),
      ).toBeVisible()
      expect(screen.getByRole('button', { name: 'Gửi' })).toBeVisible()
    })
    expect(composer).toHaveValue('')
    expect(screen.getByText(/Còn 4 lượt/)).toBeVisible()
    expect(companionBrowserClient.send).toHaveBeenCalledTimes(1)
    const chat = screen.getByRole('region', { name: 'AI Companion' })
    expect(within(chat).getAllByText('Chỉ gửi một lần')).toHaveLength(1)
    expect(
      within(chat).getAllByText('Mình đã nhận được tin nhắn.'),
    ).toHaveLength(1)

    expect(companionBrowserClient.get).toHaveBeenCalledTimes(1)
    expect(companionBrowserClient.send).toHaveBeenCalledTimes(1)
    expect(within(chat).getAllByText('Chỉ gửi một lần')).toHaveLength(1)
    expect(
      within(chat).getAllByText('Mình đã nhận được tin nhắn.'),
    ).toHaveLength(1)
  })

  it('shows one suggestion link after the reply finishes and keeps it after reload', async () => {
    vi.mocked(companionBrowserClient.get).mockResolvedValueOnce(conversation)
    vi.mocked(companionBrowserClient.send).mockResolvedValue({
      conversationId: conversation.conversationId,
      userMessageId: '44444444-4444-4444-8444-444444444444',
      assistantMessageId: '55555555-5555-4555-8555-555555555555',
      assistant: 'Okela, bạn mở bài ở nút bên dưới nha.',
      createdAt: '2026-11-03T08:01:00Z',
      contextKinds: [],
      quota: {
        plan: 'FREE',
        policyVersion: 'companion-quota-v2',
        remaining: 4,
        resetAt: '2026-11-03T17:00:00Z',
        limitDisplayed: true,
      },
      suggestion: {
        destination: 'RESOURCE',
        resourceId: '66666666-6666-4666-8666-666666666666',
        resourceTitle: 'Thở 4-7-8',
      },
    })
    const user = userEvent.setup()
    const { unmount } = render(<AiCompanionChat accountId={accountId} />)
    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await user.type(composer, 'Ừ, thử bài thở đó coi')
    await user.click(screen.getByRole('button', { name: 'Gửi' }))

    expect(
      await screen.findByRole('button', { name: 'Dừng phản hồi' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('link', { name: 'Mở bài: Thở 4-7-8' }),
    ).not.toBeInTheDocument()
    await screen.findByRole('button', { name: 'Gửi' }, { timeout: 5_000 })
    const link = screen.getByRole('link', { name: 'Mở bài: Thở 4-7-8' })
    expect(link).toHaveAttribute(
      'href',
      '/resources/66666666-6666-4666-8666-666666666666?from=ai-companion',
    )
    expect(screen.getByRole('button', { name: 'Gửi' })).toBeVisible()
    unmount()

    vi.mocked(companionBrowserClient.get).mockResolvedValueOnce({
      ...conversation,
      messages: [
        {
          messageId: '55555555-5555-4555-8555-555555555555',
          role: 'ASSISTANT',
          content: 'Okela, bạn mở bài ở nút bên dưới nha.',
          createdAt: '2026-11-03T08:01:00Z',
          contextKinds: [],
          suggestion: {
            destination: 'JOURNAL',
            resourceId: null,
            resourceTitle: null,
          },
        },
        {
          messageId: '77777777-7777-4777-8777-777777777777',
          role: 'ASSISTANT',
          content: 'Mình vẫn ở đây nè.',
          createdAt: '2026-11-03T08:02:00Z',
          contextKinds: [],
          suggestion: null,
        },
      ],
    })
    render(<AiCompanionChat accountId={accountId} />)
    expect(
      await screen.findByRole('link', { name: 'Mở Nhật ký' }),
    ).toHaveAttribute('href', '/journal')
    expect(
      screen.getAllByRole('link', { name: /^(?:Mở |Tìm chuyên gia)/ }),
    ).toHaveLength(1)
  })

  describe('resend and drafts (MB-829)', () => {
    const sent = {
      conversationId: conversation.conversationId,
      userMessageId: '44444444-4444-4444-8444-444444444444',
      assistantMessageId: '55555555-5555-4555-8555-555555555555',
      assistant: 'Mình đang lắng nghe.',
      createdAt: '2026-09-20T08:01:00Z',
      contextKinds: [],
      quota: {
        plan: 'FREE' as const,
        policyVersion: 'companion-quota-v2' as const,
        remaining: 4,
        resetAt: '2026-09-20T17:00:00Z',
        limitDisplayed: true,
      },
    }
    const unknown = () =>
      new CompanionBrowserError('unknown', 'COMPANION_OUTCOME_UNKNOWN', 503)
    const keyOf = (call: number) =>
      vi.mocked(companionBrowserClient.send).mock.calls[call]?.[2]
    const composer = () => screen.findByRole('textbox', { name: 'Tin nhắn' })

    it('resends the unchanged text with the same key after an unknown outcome and shows one replayed answer', async () => {
      vi.mocked(companionBrowserClient.send)
        .mockRejectedValueOnce(unknown())
        .mockResolvedValueOnce(sent)
      const user = userEvent.setup()
      render(<AiCompanionChat accountId={accountId} />)
      await user.type(await composer(), 'Gửi một lần thôi')
      await user.click(screen.getByRole('button', { name: 'Gửi' }))
      await screen.findByRole('alert')
      await user.click(screen.getByRole('button', { name: 'Gửi lại' }))

      const chat = screen.getByRole('region', { name: 'AI Companion' })
      expect(
        await within(chat).findByText('Mình đang lắng nghe.'),
      ).toBeVisible()
      expect(vi.mocked(companionBrowserClient.send).mock.calls[1]?.[1]).toEqual(
        { message: 'Gửi một lần thôi' },
      )
      expect(keyOf(1)).toBe(keyOf(0))
      expect(within(chat).getAllByText('Gửi một lần thôi')).toHaveLength(1)
      expect(within(chat).getAllByText('Mình đang lắng nghe.')).toHaveLength(1)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('keeps the text and mints a fresh key after a definite failure', async () => {
      vi.mocked(companionBrowserClient.send)
        .mockRejectedValueOnce(
          new CompanionBrowserError(
            'quota',
            'CHAT_TOKEN_BUDGET_EXHAUSTED',
            429,
          ),
        )
        .mockResolvedValueOnce(sent)
      const user = userEvent.setup()
      render(<AiCompanionChat accountId={accountId} />)
      const box = await composer()
      await user.type(box, 'Giữ lại nội dung')
      await user.click(screen.getByRole('button', { name: 'Gửi' }))
      await screen.findByRole('alert')
      expect(box).toHaveValue('Giữ lại nội dung')
      await user.click(screen.getByRole('button', { name: 'Gửi lại' }))
      await waitFor(() =>
        expect(companionBrowserClient.send).toHaveBeenCalledTimes(2),
      )
      expect(keyOf(1)).not.toBe(keyOf(0))
    })

    it('uses a fresh key when the text is edited after an unknown outcome', async () => {
      vi.mocked(companionBrowserClient.send)
        .mockRejectedValueOnce(unknown())
        .mockResolvedValueOnce(sent)
      const user = userEvent.setup()
      render(<AiCompanionChat accountId={accountId} />)
      const box = await composer()
      await user.type(box, 'Bản đầu')
      await user.click(screen.getByRole('button', { name: 'Gửi' }))
      await screen.findByRole('alert')
      await user.type(box, ' đã sửa')
      await user.click(screen.getByRole('button', { name: 'Gửi lại' }))
      await waitFor(() =>
        expect(companionBrowserClient.send).toHaveBeenCalledTimes(2),
      )
      expect(keyOf(1)).not.toBe(keyOf(0))
    })

    it('offers Tải lại only for load errors', async () => {
      vi.mocked(companionBrowserClient.send).mockRejectedValue(unknown())
      const user = userEvent.setup()
      render(<AiCompanionChat accountId={accountId} />)
      const box = await composer()
      await user.type(box, 'Một tin')
      await user.click(screen.getByRole('button', { name: 'Gửi' }))
      await screen.findByRole('alert')
      expect(screen.queryByRole('button', { name: 'Tải lại' })).toBeNull()
      await user.clear(box)
      expect(screen.getByRole('alert')).toBeVisible()
      expect(screen.queryByRole('button', { name: 'Gửi lại' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Tải lại' })).toBeNull()
    })

    it('shows Tải lại when the list fails to load', async () => {
      vi.mocked(companionBrowserClient.list).mockRejectedValue(
        new CompanionBrowserError('down', 'COMPANION_UNAVAILABLE', 503),
      )
      render(<AiCompanionChat accountId={accountId} />)
      expect(
        await screen.findByRole('button', { name: 'Tải lại' }),
      ).toBeVisible()
    })

    it('restores the draft after a remount for the same account and conversation', async () => {
      const user = userEvent.setup()
      const first = render(<AiCompanionChat accountId={accountId} />)
      await user.type(await composer(), 'Nháp sau khi tải lại')
      expect(window.sessionStorage.getItem(draftKey)).toBe(
        'Nháp sau khi tải lại',
      )
      first.unmount()
      render(<AiCompanionChat accountId={accountId} />)
      expect(await composer()).toHaveValue('Nháp sau khi tải lại')
    })

    it("never shows another account's draft", async () => {
      window.sessionStorage.setItem(draftKey, 'Nháp của tài khoản A')
      render(
        <AiCompanionChat accountId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" />,
      )
      expect(await composer()).toHaveValue('')
    })

    it('clears the stored draft after a successful send', async () => {
      vi.mocked(companionBrowserClient.send).mockResolvedValue(sent)
      const user = userEvent.setup()
      render(<AiCompanionChat accountId={accountId} />)
      await user.type(await composer(), 'Sẽ gửi đi')
      expect(window.sessionStorage.getItem(draftKey)).toBe('Sẽ gửi đi')
      await user.click(screen.getByRole('button', { name: 'Gửi' }))
      await waitFor(() =>
        expect(window.sessionStorage.getItem(draftKey)).toBeNull(),
      )
    })

    it('clears the stored draft after the conversation is deleted', async () => {
      window.sessionStorage.setItem(draftKey, 'Nháp sẽ bị xóa')
      const user = userEvent.setup()
      render(
        <FeedbackProvider>
          <AiCompanionChat accountId={accountId} />
        </FeedbackProvider>,
      )
      expect(await composer()).toHaveValue('Nháp sẽ bị xóa')
      await user.click(
        screen.getByRole('button', { name: 'Xóa cuộc trò chuyện' }),
      )
      await user.click(
        within(await screen.findByRole('dialog')).getByRole('button', {
          name: 'Xóa cuộc trò chuyện',
        }),
      )
      await waitFor(() =>
        expect(companionBrowserClient.remove).toHaveBeenCalled(),
      )
      await waitFor(() =>
        expect(window.sessionStorage.getItem(draftKey)).toBeNull(),
      )
    })

    it('still types and sends when sessionStorage throws', async () => {
      for (const method of ['getItem', 'setItem', 'removeItem', 'key'] as const)
        vi.spyOn(Storage.prototype, method).mockImplementation(() => {
          throw new Error('blocked')
        })
      vi.mocked(companionBrowserClient.send).mockResolvedValue(sent)
      const user = userEvent.setup()
      render(<AiCompanionChat accountId={accountId} />)
      const box = await composer()
      await user.type(box, 'Không lưu được')
      expect(box).toHaveValue('Không lưu được')
      await user.click(screen.getByRole('button', { name: 'Gửi' }))
      await waitFor(() => expect(box).toHaveValue(''))
      expect(companionBrowserClient.send).toHaveBeenCalledTimes(1)
    })

    describe('interleavings (review round 1)', () => {
      const other: CompanionConversation = {
        ...conversation,
        conversationId: '66666666-6666-4666-8666-666666666666',
        title: 'Giấc ngủ gần đây',
      }
      const withTwo = () => {
        vi.mocked(companionBrowserClient.list).mockResolvedValue({
          items: [conversation, other],
        })
        vi.mocked(companionBrowserClient.get).mockImplementation(async (id) =>
          id === other.conversationId ? other : conversation,
        )
      }
      const renderChat = () =>
        render(
          <FeedbackProvider>
            <AiCompanionChat accountId={accountId} />
          </FeedbackProvider>,
        )
      const switchTo = async (
        user: ReturnType<typeof userEvent.setup>,
        name: RegExp,
        confirm = true,
      ) => {
        await user.click(screen.getByRole('button', { name }))
        if (confirm)
          await user.click(
            await screen.findByRole('button', { name: 'Chuyển hội thoại' }),
          )
      }
      const toA = /Cuộc trò chuyện mới.*Tiếp tục/
      const toB = /Giấc ngủ gần đây/

      it('resends with the same key after an unknown outcome and a reload', async () => {
        vi.mocked(companionBrowserClient.send)
          .mockRejectedValueOnce(unknown())
          .mockResolvedValueOnce(sent)
        const user = userEvent.setup()
        const first = render(<AiCompanionChat accountId={accountId} />)
        await user.type(await composer(), 'Gửi qua tải lại')
        await user.click(screen.getByRole('button', { name: 'Gửi' }))
        await screen.findByRole('alert')
        expect(
          window.sessionStorage.getItem(
            `mb.companion.pending.${accountId}.${conversation.conversationId}`,
          ),
        ).not.toBeNull()
        first.unmount()

        render(<AiCompanionChat accountId={accountId} />)
        expect(await composer()).toHaveValue('Gửi qua tải lại')
        await user.click(screen.getByRole('button', { name: 'Gửi' }))
        await waitFor(() =>
          expect(companionBrowserClient.send).toHaveBeenCalledTimes(2),
        )
        expect(keyOf(1)).toBe(keyOf(0))
        await waitFor(() =>
          expect(
            window.sessionStorage.getItem(
              `mb.companion.pending.${accountId}.${conversation.conversationId}`,
            ),
          ).toBeNull(),
        )
      })

      it("keeps conversation A's key when B sends in between", async () => {
        withTwo()
        vi.mocked(companionBrowserClient.send)
          .mockRejectedValueOnce(unknown())
          .mockResolvedValueOnce(sent)
          .mockResolvedValueOnce(sent)
        const user = userEvent.setup()
        renderChat()
        await user.type(await composer(), 'Tin của A')
        await user.click(screen.getByRole('button', { name: 'Gửi' }))
        await screen.findByRole('alert')
        await switchTo(user, toB)
        await user.type(await composer(), 'Tin của B')
        await user.click(screen.getByRole('button', { name: 'Gửi' }))
        await screen.findByRole('button', { name: 'Gửi' }, { timeout: 5_000 })
        await switchTo(user, toA, false)
        await waitFor(async () =>
          expect(await composer()).toHaveValue('Tin của A'),
        )
        await user.click(screen.getByRole('button', { name: 'Gửi' }))
        await waitFor(() =>
          expect(companionBrowserClient.send).toHaveBeenCalledTimes(3),
        )
        expect(keyOf(2)).toBe(keyOf(0))
        expect(keyOf(1)).not.toBe(keyOf(0))
      })

      it('keeps the replacement request stoppable when a stopped one settles late', async () => {
        const signals: AbortSignal[] = []
        let rejectFirst: (reason: unknown) => void = () => undefined
        vi.mocked(companionBrowserClient.send)
          .mockImplementationOnce((_id, _body, _key, signal) => {
            signals.push(signal!)
            return new Promise((_resolve, reject) => {
              rejectFirst = reject
            })
          })
          .mockImplementationOnce((_id, _body, _key, signal) => {
            signals.push(signal!)
            return new Promise(() => undefined)
          })
        const user = userEvent.setup()
        render(<AiCompanionChat accountId={accountId} />)
        const box = await composer()
        await user.type(box, 'Dừng rồi gửi lại')
        await user.click(screen.getByRole('button', { name: 'Gửi' }))
        await user.click(
          await screen.findByRole('button', { name: 'Dừng phản hồi' }),
        )
        await user.click(await screen.findByRole('button', { name: 'Gửi' }))
        expect(
          await screen.findByRole('button', { name: 'Dừng phản hồi' }),
        ).toBeVisible()

        await act(async () => rejectFirst(new Error('aborted')))
        expect(box).toBeDisabled()
        await user.click(screen.getByRole('button', { name: 'Dừng phản hồi' }))
        expect(signals).toHaveLength(2)
        expect(signals[0]!.aborted).toBe(true)
        expect(signals[1]!.aborted).toBe(true)
      })

      it('releases the composer when the origin is no longer active after a successful send', async () => {
        withTwo()
        let resolveSend: (value: typeof sent) => void = () => undefined
        vi.mocked(companionBrowserClient.send).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveSend = resolve
            }),
        )
        const user = userEvent.setup()
        renderChat()
        await user.type(await composer(), 'Tin của A')
        await user.click(screen.getByRole('button', { name: 'Gửi' }))
        await screen.findByRole('button', { name: 'Dừng phản hồi' })
        await switchTo(user, toB)

        await act(async () => resolveSend(sent))
        expect(await screen.findByRole('button', { name: 'Gửi' })).toBeVisible()
        expect(await composer()).toBeEnabled()
        expect(screen.queryByText('Mình đang lắng nghe.')).toBeNull()
        expect(screen.queryByRole('alert')).toBeNull()
        expect(
          window.sessionStorage.getItem(
            `mb.companion.pending.${accountId}.${conversation.conversationId}`,
          ),
        ).toBeNull()
      })

      it("releases the composer and hides A's error over B after a failed send", async () => {
        withTwo()
        let rejectSend: (reason: unknown) => void = () => undefined
        vi.mocked(companionBrowserClient.send).mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectSend = reject
            }),
        )
        const user = userEvent.setup()
        renderChat()
        await user.type(await composer(), 'Tin của A')
        await user.click(screen.getByRole('button', { name: 'Gửi' }))
        await screen.findByRole('button', { name: 'Dừng phản hồi' })
        await switchTo(user, toB)

        await act(async () => rejectSend(unknown()))
        expect(await screen.findByRole('button', { name: 'Gửi' })).toBeVisible()
        expect(await composer()).toBeEnabled()
        expect(screen.queryByRole('alert')).toBeNull()
        expect(
          window.sessionStorage.getItem(
            `mb.companion.pending.${accountId}.${conversation.conversationId}`,
          ),
        ).not.toBeNull()
        expect(window.sessionStorage.getItem(draftKey)).toBe('Tin của A')
      })

      it('does not keep the deleted conversation on screen when loading the next one fails', async () => {
        withTwo()
        window.sessionStorage.setItem(draftKey, 'Nháp của A')
        vi.mocked(companionBrowserClient.get)
          .mockResolvedValueOnce(conversation)
          .mockRejectedValueOnce(
            new CompanionBrowserError('down', 'COMPANION_UNAVAILABLE', 503),
          )
        const user = userEvent.setup()
        renderChat()
        expect(await composer()).toHaveValue('Nháp của A')
        await user.click(
          screen.getByRole('button', { name: 'Xóa cuộc trò chuyện' }),
        )
        await user.click(
          within(await screen.findByRole('dialog')).getByRole('button', {
            name: 'Xóa cuộc trò chuyện',
          }),
        )
        await screen.findByRole('alert')
        expect(companionBrowserClient.remove).toHaveBeenCalled()
        expect(screen.queryByDisplayValue('Nháp của A')).toBeNull()
        expect(screen.queryByRole('textbox', { name: 'Tin nhắn' })).toBeNull()
        expect(window.sessionStorage.getItem(draftKey)).toBeNull()
      })

      it("never shows the previous account's draft after the account changes", async () => {
        const otherAccount = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        const user = userEvent.setup()
        const view = render(
          <AiCompanionChat key={accountId} accountId={accountId} />,
        )
        await user.type(await composer(), 'Nháp của tài khoản A')
        let resolveList: (value: { items: [] }) => void = () => undefined
        vi.mocked(companionBrowserClient.list).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveList = resolve
            }),
        )
        view.rerender(
          <AiCompanionChat key={otherAccount} accountId={otherAccount} />,
        )
        expect(screen.queryByDisplayValue('Nháp của tài khoản A')).toBeNull()
        expect(screen.getByText('Đang tải AI Companion…')).toBeVisible()
        await waitFor(() =>
          expect(companionBrowserClient.list).toHaveBeenCalledTimes(2),
        )
        await act(async () => resolveList({ items: [] }))
        expect(
          await screen.findByText('Bắt đầu khi bạn sẵn sàng'),
        ).toBeVisible()
        expect(screen.queryByDisplayValue('Nháp của tài khoản A')).toBeNull()
      })
    })
  })
})
