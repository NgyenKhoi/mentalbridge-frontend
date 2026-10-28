import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MamCardButton } from '@/features/mam/MamCardButton'
import { MamDock } from '@/features/mam/MamDock'
import { MamDockSlot } from '@/features/mam/MamDockSlot'
import { useMamSuppress } from '@/features/mam/mam-suppression'
import { resolveMamTarget, mamFallbackText } from '@/features/mam/mam-targets'
import { useMamPageTarget, useMamTarget } from '@/features/mam/use-mam-target'
import { useMamActionExplain } from './mam-support-plan'

// The real host -> resolver -> shared Care hook -> browser API boundary; only
// the HTTP client is replaced, and it honours the request's AbortSignal.
type Call = { url: string; body: unknown; signal: AbortSignal }
const http = vi.hoisted(() => ({ calls: [] as Call[], post: vi.fn() }))
vi.mock('@/lib/api/browser-client', () => ({
  browserApiClient: { post: http.post },
}))

const navigation = vi.hoisted(() => ({ pathname: '/support-plan' }))
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))
vi.mock('@/features/mam/MamCharacter', () => ({
  MamCharacter: () => <span data-testid="mam-character" />,
}))

const supportPlanId = '10000000-0000-4000-8000-000000000772'
const actionA = '20000000-0000-4000-8000-000000000772'
const actionB = '30000000-0000-4000-8000-000000000772'

type CardKey = 'todayA' | 'planA' | 'planB'
const CARDS: Record<
  CardKey,
  { actionId: string; surface: 'TODAY' | 'PLAN'; title: string }
> = {
  todayA: { actionId: actionA, surface: 'TODAY', title: 'Việc hôm nay A' },
  planA: { actionId: actionA, surface: 'PLAN', title: 'Việc kế hoạch A' },
  planB: { actionId: actionB, surface: 'PLAN', title: 'Việc kế hoạch B' },
}

// The panels' wiring: a card registers itself with a resolver that hands the
// host's signal to the shared hook, and its button waits for another action.
function Card({
  card,
  explain,
}: Readonly<{
  card: CardKey
  explain: ReturnType<typeof useMamActionExplain>
}>) {
  const { actionId, surface, title } = CARDS[card]
  const ref = useMamTarget(
    {
      kind: surface === 'TODAY' ? 'support-plan.focus' : 'support-plan.action',
      context: { supportPlanId, actionId },
    },
    async (intent, { signal }) =>
      intent === 'EXPLAIN'
        ? explain.explain(supportPlanId, actionId, surface, signal)
        : null,
  )
  return (
    <section ref={ref} aria-label={title}>
      <h2>{title}</h2>
      <MamCardButton
        label={`Mầm giải thích: ${title}`}
        disabled={
          explain.pendingActionId !== undefined &&
          explain.pendingActionId !== actionId
        }
      />
    </section>
  )
}

function Workspace({
  show,
  dirty = false,
  identity = 'today',
}: Readonly<{ show: CardKey[]; dirty?: boolean; identity?: string }>) {
  const explain = useMamActionExplain()
  useMamSuppress(dirty)
  useMamPageTarget(
    { kind: 'support-plan.page' },
    async () => ({ text: 'Tab này dành cho việc hôm nay.' }),
    identity,
  )
  return (
    <>
      {show.map((card) => (
        <Card key={card} card={card} explain={explain} />
      ))}
    </>
  )
}

function App(props: Parameters<typeof Workspace>[0]) {
  return (
    <>
      <MamDockSlot />
      <Workspace {...props} />
      <MamDock />
    </>
  )
}

const button = (card: CardKey) =>
  screen.getByRole('button', { name: `Mầm giải thích: ${CARDS[card].title}` })
const press = (card: CardKey) => {
  fireEvent.pointerDown(button(card), { button: 0, pointerType: 'mouse' })
  fireEvent.click(button(card))
}
const active = () => http.calls.filter((call) => !call.signal.aborted)
const dialog = () => screen.queryByRole('dialog', { name: 'Mầm' })

describe('SupportPlan Mầm Care requests across the host boundary', () => {
  beforeEach(() => {
    navigation.pathname = '/support-plan'
    http.calls = []
    http.post.mockImplementation(
      (url: string, body: unknown, config?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const signal = config!.signal!
          http.calls.push({ url, body, signal })
          signal.addEventListener('abort', () => reject(new Error('canceled')))
        }),
    )
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.matchMedia = vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        disconnect = vi.fn()
      },
    )
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    http.post.mockReset()
  })

  it('keeps one POST in flight when Today moves to Plan for the same action', async () => {
    const { rerender } = render(<App show={['todayA']} />)
    press('todayA')
    expect(http.calls).toHaveLength(1)
    expect(http.calls[0].body).toEqual({ surface: 'TODAY' })

    // Leaving the tab retires the card, its bubble and its request.
    rerender(<App show={['planA']} />)
    await act(async () => {})
    await waitFor(() => expect(dialog()).toBeNull())
    expect(http.calls[0].signal.aborted).toBe(true)

    press('planA')
    expect(http.calls).toHaveLength(2)
    expect(http.calls[1].body).toEqual({ surface: 'PLAN' })
    expect(active()).toHaveLength(1)
  })

  it('keeps one POST in flight when another registered target is summoned', async () => {
    render(<App show={['planA', 'planB']} />)
    press('planA')
    expect(button('planB')).toHaveAttribute('aria-disabled', 'true')

    // The context menu bypasses the disabled button; the older request stops.
    fireEvent.contextMenu(
      screen.getByRole('region', { name: 'Việc kế hoạch B' }),
      {
        clientX: 40,
        clientY: 40,
      },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mầm giải thích' }))
    await act(async () => {})
    expect(http.calls).toHaveLength(2)
    expect(http.calls[0].signal.aborted).toBe(true)
    expect(active()).toHaveLength(1)
    expect(active()[0].url).toContain(actionB)
  })

  it('aborts the request and frees the slot when Mầm is suppressed', async () => {
    const { rerender } = render(<App show={['planA', 'planB']} />)
    press('planA')
    rerender(<App show={['planA', 'planB']} dirty />)
    await act(async () => {})
    await waitFor(() => expect(dialog()).toBeNull())
    expect(http.calls[0].signal.aborted).toBe(true)

    rerender(<App show={['planA', 'planB']} />)
    await act(async () => {})
    expect(button('planB')).not.toHaveAttribute('aria-disabled')
    press('planB')
    expect(http.calls).toHaveLength(2)
    expect(active()).toHaveLength(1)
  })

  it('aborts the request and frees the slot when the route changes', async () => {
    const { rerender } = render(<App show={['planA', 'planB']} />)
    press('planA')
    navigation.pathname = '/achievements'
    rerender(<App show={['planA', 'planB']} />)
    await act(async () => {})
    expect(http.calls[0].signal.aborted).toBe(true)
    expect(button('planB')).not.toHaveAttribute('aria-disabled')
  })

  it('aborts at the eight-second timeout, shows the fallback and frees the slot', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render(<App show={['planA', 'planB']} />)
    press('planA')
    expect(http.calls).toHaveLength(1)
    await act(async () => {
      vi.advanceTimersByTime(8000)
    })
    expect(http.calls[0].signal.aborted).toBe(true)
    expect(
      screen.getByText(
        mamFallbackText(
          resolveMamTarget({ kind: 'support-plan.action' })!,
          'EXPLAIN',
        ),
      ),
    ).toBeInTheDocument()
    expect(button('planB')).not.toHaveAttribute('aria-disabled')
    expect(http.calls).toHaveLength(1)
  })

  it('closes an open page answer when the tab or focus identity changes, with no request', async () => {
    const { rerender } = render(<App show={['planA']} identity="plan:none" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mầm' }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Hỏi Mầm về trang này' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mầm giải thích' }))
    expect(
      await screen.findByText('Tab này dành cho việc hôm nay.'),
    ).toBeInTheDocument()

    rerender(<App show={['planA']} identity="progress:none" />)
    await act(async () => {})
    await waitFor(() => expect(dialog()).toBeNull())
    expect(http.calls).toHaveLength(0)
  })
})
