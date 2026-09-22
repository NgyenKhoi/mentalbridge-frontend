import type {
  CompanionConversation,
  CompanionSend,
  CompanionSendInput,
} from '@/lib/companion/companion-contract'
import {
  parseConversation,
  parseConversationList,
  parseSend,
} from '@/lib/companion/companion-validation'

export class CompanionBrowserError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'CompanionBrowserError'
  }
}

const read = async (response: Response) => {
  try {
    return (await response.json()) as unknown
  } catch {
    return null
  }
}

const problem = (value: unknown) =>
  typeof value === 'object' && value !== null
    ? (value as { code?: unknown; title?: unknown })
    : null

async function parsed<T>(
  response: Response,
  parser: (value: unknown) => T | null,
): Promise<T> {
  const value = await read(response)
  const result = response.ok ? parser(value) : null
  if (result) return result
  const issue = problem(value)
  throw new CompanionBrowserError(
    typeof issue?.title === 'string'
      ? issue.title
      : 'AI Companion tạm thời không khả dụng.',
    typeof issue?.code === 'string' ? issue.code : 'COMPANION_UNAVAILABLE',
    response.status || 503,
  )
}

export const companionBrowserClient = {
  async list() {
    return parsed(
      await fetch('/api/ai-companion/conversations', { cache: 'no-store' }),
      parseConversationList,
    )
  },
  async create(): Promise<CompanionConversation> {
    return parsed(
      await fetch('/api/ai-companion/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
      parseConversation,
    )
  },
  async get(id: string): Promise<CompanionConversation> {
    return parsed(
      await fetch(`/api/ai-companion/conversations/${id}`, {
        cache: 'no-store',
      }),
      parseConversation,
    )
  },
  async send(
    id: string,
    body: CompanionSendInput,
    key: string,
  ): Promise<CompanionSend> {
    return parsed(
      await fetch(`/api/ai-companion/conversations/${id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify(body),
      }),
      parseSend,
    )
  },
  async remove(id: string) {
    const response = await fetch(`/api/ai-companion/conversations/${id}`, {
      method: 'DELETE',
    })
    if (response.status === 204) return
    const value = await read(response)
    const issue = problem(value)
    throw new CompanionBrowserError(
      typeof issue?.title === 'string'
        ? issue.title
        : 'Không thể xóa cuộc trò chuyện.',
      typeof issue?.code === 'string' ? issue.code : 'COMPANION_UNAVAILABLE',
      response.status || 503,
    )
  },
}
