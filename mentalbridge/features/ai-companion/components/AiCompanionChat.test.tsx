import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanionConversation } from '@/lib/companion/companion-contract'
import {
  CompanionBrowserError,
  companionBrowserClient,
} from '../api/browser-client'
import AiCompanionChat from './AiCompanionChat'

vi.mock('../api/browser-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/browser-client')>()
  return {
    ...actual,
    companionBrowserClient: {
      list: vi.fn(),
      create: vi.fn(),
      get: vi.fn(),
      send: vi.fn(),
      remove: vi.fn(),
    },
  }
})

const conversation: CompanionConversation = {
  conversationId: '11111111-1111-4111-8111-111111111111',
  title: 'Cuộc trò chuyện mới',
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
    vi.mocked(companionBrowserClient.list).mockResolvedValue({
      items: [conversation],
    })
    vi.mocked(companionBrowserClient.get).mockResolvedValue(conversation)
    vi.mocked(companionBrowserClient.create).mockResolvedValue(conversation)
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

  it('loads history and sends only explicitly selected minimized context', async () => {
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
      quota: {
        plan: 'FREE',
        policyVersion: 'companion-quota-v1',
        remaining: 4,
        resetAt: '2026-09-20T17:00:00Z',
        limitDisplayed: true,
      },
    })
    const user = userEvent.setup()
    render(<AiCompanionChat />)

    await user.click(
      await screen.findByRole('checkbox', { name: 'Một ngày bình tĩnh hơn' }),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Tin nhắn' }),
      'Mình nên bắt đầu từ đâu?',
    )
    await user.click(screen.getByRole('button', { name: 'Gửi' }))

    await waitFor(() =>
      expect(companionBrowserClient.send).toHaveBeenCalledWith(
        conversation.conversationId,
        {
          message: 'Mình nên bắt đầu từ đâu?',
          context: {
            journalIds: ['22222222-2222-4222-8222-222222222222'],
            includeCurrentSupportPlan: true,
            includeReminderContext: false,
          },
        },
        expect.any(String),
      ),
    )
    expect(await screen.findByText('Hãy chọn một bước nhỏ.')).toBeVisible()
    expect(screen.getByText(/Còn 4 lượt/)).toBeVisible()
    expect(screen.getByText(/JOURNAL, SUPPORT_PLAN/)).toBeVisible()
  })

  it('shows consent withdrawal separately and retains the draft for retry', async () => {
    vi.mocked(companionBrowserClient.send).mockRejectedValue(
      new CompanionBrowserError('denied', 'AI_CONSENT_REQUIRED', 403),
    )
    const user = userEvent.setup()
    render(<AiCompanionChat />)
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
    render(<AiCompanionChat />)
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
        quota: {
          plan: 'FREE',
          policyVersion: 'companion-quota-v1',
          remaining: 4,
          resetAt: '2026-09-20T17:00:00Z',
          limitDisplayed: true,
        },
      })
    const user = userEvent.setup()
    render(<AiCompanionChat />)
    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await user.type(composer, 'Giữ nguyên bản nháp')

    await user.click(screen.getByRole('button', { name: 'Gửi' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Gửi' }))

    await waitFor(() =>
      expect(companionBrowserClient.send).toHaveBeenCalledTimes(2),
    )
    expect(vi.mocked(companionBrowserClient.send).mock.calls[0]?.[2]).not.toBe(
      vi.mocked(companionBrowserClient.send).mock.calls[1]?.[2],
    )
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
        quota: {
          plan: 'FREE',
          policyVersion: 'companion-quota-v1',
          remaining: 4,
          resetAt: '2026-09-20T17:00:00Z',
          limitDisplayed: true,
        },
      })
    const user = userEvent.setup()
    render(<AiCompanionChat />)
    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await user.type(composer, 'Giữ cùng khóa gửi')

    await user.click(screen.getByRole('button', { name: 'Gửi' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Gửi' }))

    await waitFor(() =>
      expect(companionBrowserClient.send).toHaveBeenCalledTimes(2),
    )
    expect(vi.mocked(companionBrowserClient.send).mock.calls[0]?.[2]).toBe(
      vi.mocked(companionBrowserClient.send).mock.calls[1]?.[2],
    )
  })

  it('commits a successful send when the immediate detail refresh fails', async () => {
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
    vi.mocked(companionBrowserClient.get)
      .mockResolvedValueOnce(conversation)
      .mockRejectedValueOnce(
        new CompanionBrowserError(
          'malformed detail',
          'COMPANION_MALFORMED_RESPONSE',
          502,
        ),
      )
      .mockResolvedValueOnce(answered)
    vi.mocked(companionBrowserClient.send).mockResolvedValue({
      conversationId: conversation.conversationId,
      userMessageId: answered.messages[0]!.messageId,
      assistantMessageId: answered.messages[1]!.messageId,
      assistant: answered.messages[1]!.content,
      createdAt: answered.messages[1]!.createdAt,
      quota: {
        plan: 'FREE',
        policyVersion: 'companion-quota-v1',
        remaining: 4,
        resetAt: '2026-09-20T17:00:00Z',
        limitDisplayed: true,
      },
    })
    const user = userEvent.setup()
    render(<AiCompanionChat />)
    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await user.type(composer, 'Chỉ gửi một lần')

    await user.click(screen.getByRole('button', { name: 'Gửi' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tin nhắn đã được gửi nhưng chưa thể tải lại cuộc trò chuyện',
    )
    expect(composer).toHaveValue('')
    expect(screen.getByText(/Còn 4 lượt/)).toBeVisible()
    expect(companionBrowserClient.send).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('Chỉ gửi một lần')).toHaveLength(1)
    expect(screen.getAllByText('Mình đã nhận được tin nhắn.')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Tải lại' }))

    await waitFor(() =>
      expect(companionBrowserClient.get).toHaveBeenCalledTimes(3),
    )
    expect(companionBrowserClient.send).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('Chỉ gửi một lần')).toHaveLength(1)
    expect(screen.getAllByText('Mình đã nhận được tin nhắn.')).toHaveLength(1)
  })
})
