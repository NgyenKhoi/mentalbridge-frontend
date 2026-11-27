import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MamGuideBubble } from './MamGuideBubble'
import { MamGuideConsent } from './MamGuideConsent'
import type { MamBubbleSpec } from './mam-guide'

const story: MamBubbleSpec = {
  kind: 'story',
  text: 'Mầm đọc kết quả của bạn rồi nè.',
}
const ask: MamBubbleSpec = {
  kind: 'ask',
  text: 'Bạn thử viết cùng Mầm không?',
  actions: [
    { label: 'Viết nhật ký cùng Mầm', tone: 'primary', go: 'journal' },
    { label: 'Để sau đi', tone: 'secondary', go: 'decline' },
  ],
}

function renderBubble(spec: MamBubbleSpec, overrides = {}) {
  const props = {
    spec,
    step: 0,
    context: false,
    reduced: true,
    bubbleRef: createRef<HTMLDivElement>(),
    dockRef: createRef<HTMLElement>(),
    progress: { at: 0, total: 4 },
    onNext: vi.fn(),
    onAct: vi.fn(),
    onConsented: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<MamGuideBubble {...props} />) }
}

describe('MamGuideBubble', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('moves a story on after its hold time', () => {
    const { props } = renderBubble(story)
    act(() => vi.advanceTimersByTime(3900))
    expect(props.onNext).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1200))
    expect(props.onNext).toHaveBeenCalledTimes(1)
  })

  it('"Tiếp" moves on one bubble', () => {
    const { props } = renderBubble(story)
    fireEvent.click(screen.getByRole('button', { name: /^Tiếp, câu 1 trên 4/ }))
    expect(props.onNext).toHaveBeenCalledTimes(1)
  })

  it('no key closes the guide, Escape included', () => {
    const { props } = renderBubble(ask)
    const bubble = screen.getByRole('group')
    bubble.focus()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.keyDown(document, { key: 'a' })
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('an ask waits for the user and reports the chosen action', () => {
    const { props } = renderBubble(ask)
    act(() => vi.advanceTimersByTime(20_000))
    expect(props.onNext).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link', { name: 'Viết nhật ký cùng Mầm' }))
    expect(props.onAct).toHaveBeenCalledWith(ask.actions[0])
  })

  it('a click elsewhere pauses the story until the user resumes it', () => {
    const { props } = renderBubble(story)
    fireEvent.pointerDown(document.body)
    act(() => vi.advanceTimersByTime(10_000))
    expect(props.onNext).not.toHaveBeenCalled()
    fireEvent.pointerDown(
      screen.getAllByText('Mầm đọc kết quả của bạn rồi nè.')[0]!,
    )
    act(() => vi.advanceTimersByTime(5000))
    expect(props.onNext).toHaveBeenCalledTimes(1)
  })

  it('shows the context line only when Mầm may use it', () => {
    const spec: MamBubbleSpec = {
      kind: 'story',
      text: 'Mầm thấy bạn vừa viết xong rồi nè.',
      withContext: 'Ê, Mầm đọc rồi nè.',
    }
    renderBubble(spec, { context: true })
    // The visible line, then the live region one tick later (announced after mount).
    act(() => vi.advanceTimersByTime(60))
    expect(screen.getAllByText('Ê, Mầm đọc rồi nè.')).toHaveLength(2)
  })

  it('the close button counts as later', () => {
    const { props } = renderBubble(ask)
    fireEvent.click(screen.getByRole('button', { name: 'Đóng, để sau' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('MamGuideConsent', () => {
  const posted: unknown[] = []
  beforeEach(() => {
    posted.length = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posted.push(JSON.parse(String(init.body)))
          return new Response('{}', { status: 201 })
        }
        return new Response(
          JSON.stringify({ title: 't', content: 'Thông tin xử lý.' }),
          { status: 200 },
        )
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps Đồng ý off until the first tick and says why', async () => {
    render(<MamGuideConsent l1Granted={false} onDone={vi.fn()} />)
    const agree = screen.getByRole('button', {
      name: 'Đồng ý',
    }) as HTMLButtonElement
    expect(agree.disabled).toBe(true)
    expect(
      screen.getByText('Bạn cần tick ô đầu tiên để dùng AI nhé.'),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByLabelText('Cho AI xử lý nội dung bạn vừa viết để trả lời'),
    )
    await waitFor(() => expect(agree.disabled).toBe(false))
  })

  it('does not record consent when the current disclosure is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 })),
    )
    const onDone = vi.fn()
    render(<MamGuideConsent l1Granted={false} onDone={onDone} />)
    fireEvent.click(
      screen.getByLabelText('Cho AI xử lý nội dung bạn vừa viết để trả lời'),
    )
    await screen.findByText(/Chưa tải được thông tin xử lý AI/)
    expect(screen.getByRole('button', { name: 'Đồng ý' })).toBeDisabled()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('records one decision per ticked level and nothing for an unticked L2', async () => {
    const onDone = vi.fn()
    render(<MamGuideConsent l1Granted={false} onDone={onDone} />)
    fireEvent.click(
      screen.getByLabelText('Cho AI xử lý nội dung bạn vừa viết để trả lời'),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Đồng ý' })).not.toBeDisabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý' }))
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({ l1: true, l2: false }),
    )
    expect(posted).toEqual([
      {
        consentType: 'AI_PROCESSING',
        policyVersion: 'ai-processing-capstone-v2',
        granted: true,
      },
    ])
  })

  it('shows only the second tick when L1 is already on', async () => {
    const onDone = vi.fn()
    render(<MamGuideConsent l1Granted onDone={onDone} />)
    expect(
      screen.queryByLabelText('Cho AI xử lý nội dung bạn vừa viết để trả lời'),
    ).toBeNull()
    fireEvent.click(
      screen.getByLabelText(
        'Cho Mầm đọc nhật ký của bạn để dẫn bạn đi đúng hơn',
      ),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Đồng ý' })).not.toBeDisabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý' }))
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith({ l1: true, l2: true }),
    )
    expect(posted).toEqual([
      {
        consentType: 'AI_CONTEXT_PROCESSING',
        policyVersion: 'ai-context-processing-capstone-v1',
        granted: true,
      },
    ])
  })

  it('keeps L1 when L2 fails and lets the user retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method !== 'POST')
          return new Response(
            JSON.stringify({ title: 't', content: 'Thông tin xử lý.' }),
          )
        const body = JSON.parse(String(init.body))
        posted.push(body)
        return new Response('{}', {
          status: body.consentType === 'AI_CONTEXT_PROCESSING' ? 503 : 201,
        })
      }),
    )
    const onDone = vi.fn()
    render(<MamGuideConsent l1Granted={false} onDone={onDone} />)
    fireEvent.click(
      screen.getByLabelText('Cho AI xử lý nội dung bạn vừa viết để trả lời'),
    )
    fireEvent.click(
      screen.getByLabelText(
        'Cho Mầm đọc nhật ký của bạn để dẫn bạn đi đúng hơn',
      ),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Đồng ý' })).not.toBeDisabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý' }))
    await screen.findByRole('alert')
    expect(onDone).not.toHaveBeenCalled()
    expect(
      screen.queryByLabelText('Cho AI xử lý nội dung bạn vừa viết để trả lời'),
    ).toBeNull()
    expect(
      (screen.getByRole('button', { name: 'Đồng ý' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })

  it('"Để sau đi" records nothing', () => {
    const onDone = vi.fn()
    render(<MamGuideConsent l1Granted={false} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Để sau đi' }))
    expect(onDone).toHaveBeenCalledWith('later')
    expect(posted).toEqual([])
  })
})
