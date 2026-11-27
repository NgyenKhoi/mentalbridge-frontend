import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { CONNECT_DRAFT, localToday } from '@/features/mam/companion-copy'
import { resetMamDailyMemory } from '@/features/mam/mam-daily'
import type { CompanionConversation } from '@/lib/companion/companion-contract'
import { companionBrowserClient } from '../api/browser-client'
import AiCompanionChat from './AiCompanionChat'

const companionState = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@/features/mam/companion-state', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/mam/companion-state')>()),
  createCompanionCommitment: companionState.create,
  loadCompanionState: vi.fn().mockResolvedValue(null),
  peekCompanionState: () => null,
  subscribeCompanionState: () => () => {},
}))
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
const conversationId = '11111111-1111-4111-8111-111111111111'

const message = (n: number, role: 'USER' | 'ASSISTANT') => ({
  messageId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  role,
  content: role === 'USER' ? `Mình kể lần ${n}` : `Mầm nghe rồi lần ${n}.`,
  createdAt: '2026-11-27T08:00:00Z',
  contextKinds: [],
})

/** user, assistant, user, assistant, ... ending on an assistant reply. */
const turns = (userMessages: number): CompanionConversation['messages'] =>
  Array.from({ length: userMessages * 2 }, (_, index) =>
    message(index + 1, index % 2 === 0 ? 'USER' : 'ASSISTANT'),
  )

const conversation = (
  messages: CompanionConversation['messages'],
): CompanionConversation => ({
  conversationId,
  title: 'Cuộc trò chuyện',
  context: {
    sources: { plan: true, diary: false, screening: false, resourceIds: [] },
    updatedAt: '2026-11-27T08:00:00Z',
  },
  messages,
  createdAt: '2026-11-27T08:00:00Z',
  updatedAt: '2026-11-27T08:00:00Z',
  expiresAt: '2027-02-25T08:00:00Z',
})

const open = (messages: CompanionConversation['messages']) => {
  vi.mocked(companionBrowserClient.list).mockResolvedValue({
    items: [conversation(messages)],
  })
  vi.mocked(companionBrowserClient.get).mockResolvedValue(
    conversation(messages),
  )
  return render(
    <FeedbackProvider>
      <AiCompanionChat accountId={accountId} />
    </FeedbackProvider>,
  )
}

describe('AiCompanionChat: lời hẹn offer and the connect draft', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    resetMamDailyMemory()
    window.history.replaceState(null, '', '/ai-companion')
    companionState.create.mockReset()
    vi.mocked(companionBrowserClient.create).mockResolvedValue(conversation([]))
  })

  it('offers "Hẹn Mầm 1 việc nhỏ" under the latest reply once the user has sent 3 messages', async () => {
    open(turns(3))

    expect(
      await screen.findByRole('button', { name: 'Hẹn Mầm 1 việc nhỏ' }),
    ).toBeInTheDocument()
  })

  it.each([[1], [2]])('stays out with only %i user messages', async (count) => {
    open(turns(count))

    await screen.findAllByText(`Mầm nghe rồi lần ${count * 2}.`)
    expect(
      screen.queryByRole('button', { name: 'Hẹn Mầm 1 việc nhỏ' }),
    ).toBeNull()
  })

  it('stays out while the user message is the latest one', async () => {
    open([...turns(3), message(7, 'USER')])

    await screen.findAllByText('Mình kể lần 7')
    expect(
      screen.queryByRole('button', { name: 'Hẹn Mầm 1 việc nhỏ' }),
    ).toBeNull()
  })

  it('is offered once per conversation per day, not again after a reload', async () => {
    const first = open(turns(3))
    await screen.findByRole('button', { name: 'Hẹn Mầm 1 việc nhỏ' })
    first.unmount()

    open(turns(3))
    await screen.findAllByText('Mầm nghe rồi lần 6.')
    expect(
      screen.queryByRole('button', { name: 'Hẹn Mầm 1 việc nhỏ' }),
    ).toBeNull()
    expect(
      localStorage.getItem(
        `mentalbridge_mam_chat-commit:${accountId}:${conversationId}:${localToday()}`,
      ),
    ).toBe('1')
  })

  it('makes a lời hẹn from the chat (source CHAT) and says so', async () => {
    const user = userEvent.setup()
    companionState.create.mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000001',
      kind: 'MOVE',
      minutes: 5,
      dueOn: '2026-11-28',
      source: 'CHAT',
      status: 'OPEN',
      createdAt: '2026-11-27T08:00:00.000Z',
      resolvedAt: null,
    })
    open(turns(3))

    await user.click(
      await screen.findByRole('button', { name: 'Hẹn Mầm 1 việc nhỏ' }),
    )
    await user.click(screen.getByRole('radio', { name: 'Vận động nhẹ' }))
    await user.click(screen.getByRole('button', { name: 'Hẹn Mầm' }))

    expect(
      await screen.findByText(
        'Đã hẹn: vận động nhẹ, ngày mai. Mầm sẽ hỏi lại.',
      ),
    ).toBeInTheDocument()
    expect(companionState.create).toHaveBeenCalledWith(
      accountId,
      expect.objectContaining({ kind: 'MOVE', minutes: 5, source: 'CHAT' }),
    )
    expect(
      screen.queryByRole('button', { name: 'Soạn tin cùng Mầm' }),
    ).toBeNull()
  })

  it('CONNECT_PERSON also offers "Soạn tin cùng Mầm", which only fills the composer', async () => {
    const user = userEvent.setup()
    companionState.create.mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000002',
      kind: 'CONNECT_PERSON',
      minutes: 5,
      dueOn: '2026-11-28',
      source: 'CHAT',
      status: 'OPEN',
      createdAt: '2026-11-27T08:00:00.000Z',
      resolvedAt: null,
    })
    open(turns(3))

    await user.click(
      await screen.findByRole('button', { name: 'Hẹn Mầm 1 việc nhỏ' }),
    )
    await user.click(screen.getByRole('radio', { name: 'Nhắn cho 1 người' }))
    await user.click(screen.getByRole('button', { name: 'Hẹn Mầm' }))
    await user.click(
      await screen.findByRole('button', { name: 'Soạn tin cùng Mầm' }),
    )

    const composer = screen.getByRole('textbox', { name: 'Tin nhắn' })
    await waitFor(() => expect(composer).toHaveValue(CONNECT_DRAFT))
    await waitFor(() => expect(composer).toHaveFocus())
    expect(vi.mocked(companionBrowserClient.send)).not.toHaveBeenCalled()
  })

  it('"Thôi" closes the offer and gives focus back to the composer', async () => {
    const user = userEvent.setup()
    open(turns(3))

    await user.click(
      await screen.findByRole('button', { name: 'Hẹn Mầm 1 việc nhỏ' }),
    )
    await user.click(screen.getByRole('button', { name: 'Thôi' }))

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Tin nhắn' })).toHaveFocus(),
    )
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('?draft=connect fills the composer once, focuses it, drops the query and sends nothing', async () => {
    window.history.replaceState(null, '', '/ai-companion?draft=connect')
    open(turns(1))

    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await waitFor(() => expect(composer).toHaveValue(CONNECT_DRAFT))
    await waitFor(() => expect(composer).toHaveFocus())
    expect(window.location.search).toBe('')
    expect(vi.mocked(companionBrowserClient.send)).not.toHaveBeenCalled()
  })

  it('?draft=connect never overwrites what the user already typed', async () => {
    window.history.replaceState(null, '', '/ai-companion?draft=connect')
    sessionStorage.setItem(
      `mb.companion.draft.${accountId}.${conversationId}`,
      'Đang gõ dở',
    )
    open(turns(1))

    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await waitFor(() => expect(composer).toHaveFocus())
    expect(composer).toHaveValue('Đang gõ dở')
  })

  it('?draft=connect with no conversation yet starts one and fills it', async () => {
    window.history.replaceState(null, '', '/ai-companion?draft=connect')
    vi.mocked(companionBrowserClient.list).mockResolvedValue({ items: [] })
    vi.mocked(companionBrowserClient.create).mockResolvedValue(conversation([]))
    render(
      <FeedbackProvider>
        <AiCompanionChat accountId={accountId} />
      </FeedbackProvider>,
    )

    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await waitFor(() => expect(composer).toHaveValue(CONNECT_DRAFT))
    expect(companionBrowserClient.create).toHaveBeenCalledOnce()
  })

  it('?draft=connect still applies after a failed start, once the user retries', async () => {
    window.history.replaceState(null, '', '/ai-companion?draft=connect')
    vi.mocked(companionBrowserClient.list).mockResolvedValue({ items: [] })
    vi.mocked(companionBrowserClient.create)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(conversation([]))
    render(
      <FeedbackProvider>
        <AiCompanionChat accountId={accountId} />
      </FeedbackProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Tải lại' }))

    const composer = await screen.findByRole('textbox', { name: 'Tin nhắn' })
    await waitFor(() => expect(composer).toHaveValue(CONNECT_DRAFT))
    expect(companionBrowserClient.create).toHaveBeenCalledTimes(2)
  })
})
