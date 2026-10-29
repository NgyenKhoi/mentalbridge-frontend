import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MamDock } from '@/features/mam/MamDock'
import { MamDockSlot } from '@/features/mam/MamDockSlot'
import { isMamFeatureSuppressed } from '@/features/mam/mam-suppression'
import { MAM_TARGETS_VERSION } from '@/features/mam/mam-targets'
import { findMamTarget } from '@/features/mam/use-mam-target'
import { ApiError } from '@/lib/api/api-error'
import type { EmotionCheckIn } from '@/lib/emotion-check-in/contract'
import {
  createEmotionCheckIn,
  getEmotionCheckIn,
  updateEmotionCheckIn,
} from './api/browser-emotion-check-in'
import { DailyEmotionCheckIn } from './DailyEmotionCheckIn'

const navigation = vi.hoisted(() => ({ pathname: '/dashboard' }))
// Every prop the Mầm card button receives, to prove none carries check-in data.
const cardButtonProps = vi.hoisted(() => ({ seen: [] as unknown[] }))
// Every argument list the real `useMamTarget` is called with: the boundary
// before the resolver can drop anything.
const targetCalls = vi.hoisted(() => ({ args: [] as unknown[][] }))

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }))
vi.mock('@/features/mam/MamCharacter', () => ({
  MamCharacter: () => <span data-testid="mam-character" />,
}))
vi.mock('@/features/mam/use-mam-target', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/mam/use-mam-target')>()
  return {
    ...actual,
    useMamTarget: (...args: Parameters<typeof actual.useMamTarget>) => {
      targetCalls.args.push(args)
      return actual.useMamTarget(...args)
    },
  }
})
vi.mock('@/features/mam/MamCardButton', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/mam/MamCardButton')>()
  return {
    MamCardButton: (props: ComponentProps<typeof actual.MamCardButton>) => {
      cardButtonProps.seen.push(props)
      return <actual.MamCardButton {...props} />
    },
  }
})
vi.mock('./api/browser-emotion-check-in', () => ({
  createEmotionCheckIn: vi.fn(),
  deleteEmotionCheckIn: vi.fn(),
  getEmotionCheckIn: vi.fn(),
  listEmotionCheckIns: vi.fn(),
  updateEmotionCheckIn: vi.fn(),
}))

const get = vi.mocked(getEmotionCheckIn)
const create = vi.mocked(createEmotionCheckIn)
const update = vi.mocked(updateEmotionCheckIn)
const notFound = () =>
  new ApiError({
    message: 'not found',
    code: 'RESOURCE_NOT_FOUND',
    status: 404,
  })

const SAVED_NOTE = 'SENTINEL-saved-note-7f3a'
const DRAFT_NOTE = 'SENTINEL-draft-note-c9d1'
const SAVED_ID = '40000000-0000-4000-8000-0000005a1e77'
const BUTTON = 'Mầm giải thích: Cảm xúc hôm nay'

const record = (): EmotionCheckIn => ({
  id: SAVED_ID,
  localDate: '2026-10-29',
  timezone: 'Asia/Ho_Chi_Minh',
  emotion: 'VERY_LOW',
  intensity: 5,
  factors: ['family'],
  note: SAVED_NOTE,
  sourceLabel: 'SELF_REPORTED_EMOTION',
  clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
  revision: 3,
  recordedAt: '2026-10-29T02:00:00.000Z',
  createdAt: '2026-10-29T02:00:00.000Z',
  updatedAt: '2026-10-29T02:00:00.000Z',
})

// Only the fields the card reads; the resolver itself is covered elsewhere.
const planOrigin = {
  occurrenceId: '50000000-0000-4000-8000-000000000771',
  actionId: '20000000-0000-4000-8000-000000000771',
  localDate: '2026-10-29',
  title: 'Check-in cảm xúc',
  timezone: 'Asia/Ho_Chi_Minh',
  activatedAt: '2026-10-01T00:00:00.000Z',
} as unknown as ComponentProps<typeof DailyEmotionCheckIn>['planOrigin']

const cardButton = () => screen.queryByRole('button', { name: BUTTON })
const card = () => document.getElementById('emotion-check-in')!

function App({ slot = true }: Readonly<{ slot?: boolean }>) {
  return (
    <>
      {slot ? <MamDockSlot /> : null}
      <DailyEmotionCheckIn />
      <MamDock />
    </>
  )
}

describe('DailyEmotionCheckIn Mầm entry', () => {
  beforeEach(() => {
    get.mockReset()
    create.mockReset()
    update.mockReset()
    cardButtonProps.seen = []
    navigation.pathname = '/dashboard'
    window.localStorage.clear()
    window.sessionStorage.clear()
    Element.prototype.scrollIntoView = vi.fn()
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
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('shows no button and registers no target while loading, empty or failed', async () => {
    get.mockReturnValue(new Promise(() => {}))
    const { unmount } = render(<App />)
    expect(cardButton()).toBeNull()
    expect(findMamTarget(card())).toBeNull()
    unmount()

    get.mockRejectedValue(notFound())
    render(<App />)
    await screen.findByRole('radio', { name: 'Tốt' })
    expect(cardButton()).toBeNull()
    expect(findMamTarget(card())).toBeNull()
  })

  it('shows the button for a clean loaded record and registers the no-context target', async () => {
    get.mockResolvedValue(record())
    render(<App />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: BUTTON })).toBeVisible(),
    )
    await waitFor(() =>
      expect(findMamTarget(card())?.target).toEqual({
        version: MAM_TARGETS_VERSION,
        kind: 'home.emotion',
        page: false,
        intents: ['EXPLAIN'],
        context: {},
      }),
    )
  })

  it('shows nothing with the flag off (no dock slot)', async () => {
    get.mockResolvedValue(record())
    render(<App slot={false} />)
    await screen.findByRole('radio', { name: 'Rất không tốt' })
    expect(cardButton()).toBeNull()
    expect(findMamTarget(card())).toBeNull()
  })

  it('removes the button and target while editing, and suppresses Mầm', async () => {
    const user = userEvent.setup()
    get.mockResolvedValue(record())
    render(<App />)
    await screen.findByRole('button', { name: BUTTON })
    expect(isMamFeatureSuppressed()).toBe(false)

    await user.click(screen.getByRole('radio', { name: 'Tốt' }))
    await waitFor(() => expect(cardButton()).toBeNull())
    expect(findMamTarget(card())).toBeNull()
    expect(isMamFeatureSuppressed()).toBe(true)

    // Back to the saved value: clean again, but focus is still in the form.
    await user.click(screen.getByRole('radio', { name: 'Rất không tốt' }))
    await waitFor(() => expect(cardButton()).toBeNull())
    expect(isMamFeatureSuppressed()).toBe(true)

    act(() => (document.activeElement as HTMLElement).blur())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: BUTTON })).toBeVisible(),
    )
    expect(isMamFeatureSuppressed()).toBe(false)
  })

  it('suppresses while focus is inside the form even when nothing changed', async () => {
    const user = userEvent.setup()
    get.mockResolvedValue(record())
    render(<App />)
    await screen.findByRole('button', { name: BUTTON })
    await user.tab()
    await user.tab()
    expect(card().querySelector('form')?.contains(document.activeElement)).toBe(
      true,
    )
    await waitFor(() => expect(cardButton()).toBeNull())
    expect(isMamFeatureSuppressed()).toBe(true)
  })

  it('keeps the button after a save and does not dispatch a saved reaction', async () => {
    const user = userEvent.setup()
    get.mockRejectedValue(notFound())
    create.mockResolvedValue({ ...record(), emotion: 'GOOD', note: null })
    const events: string[] = []
    const dispatch = window.dispatchEvent.bind(window)
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      events.push(event.type)
      return dispatch(event)
    })
    render(<App />)
    await screen.findByRole('radio', { name: 'Tốt' })
    await user.click(screen.getByRole('radio', { name: 'Tốt' }))
    await user.click(await screen.findByRole('radio', { name: '4' }))
    await user.click(screen.getByRole('button', { name: 'Lưu ghi nhận' }))
    await screen.findByTestId('emotion-saved')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: BUTTON })).toBeVisible(),
    )
    expect(events).not.toContain('mam:saved')
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa ghi nhận' }))
    // Clean and unfocused: still the saved record. Touching the form removes it.
    expect(cardButton()).not.toBeNull()
    await user.click(screen.getByRole('radio', { name: 'Bình thường' }))
    await waitFor(() => expect(cardButton()).toBeNull())
  })

  it('opens the reviewed bubble on press with no request, and closes it when editing starts', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    get.mockResolvedValue(record())
    render(<App />)
    const button = await screen.findByRole('button', { name: BUTTON })
    await user.click(button)
    const bubble = await screen.findByRole('dialog', { name: 'Mầm' })
    expect(bubble).toHaveTextContent(
      'Bạn đã lưu cảm xúc hôm nay. Nếu muốn kể rõ hơn điều đã xảy ra, hãy viết vài dòng vào Nhật ký.',
    )
    expect(card()).toHaveAttribute('data-mam-active')
    expect(fetchSpy).not.toHaveBeenCalled()

    // Focus moving into the form is an edit zone: the bubble closes with it.
    fireEvent.click(screen.getByRole('radio', { name: 'Tốt' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Mầm' })).toBeNull(),
    )
  })

  it('does not offer the button inside the plan flow', async () => {
    get.mockResolvedValue(record())
    render(
      <>
        <MamDockSlot />
        <DailyEmotionCheckIn planOrigin={planOrigin} />
        <MamDock />
      </>,
    )
    await screen.findByRole('radio', { name: 'Rất không tốt' })
    expect(cardButton()).toBeNull()
    expect(findMamTarget(card())).toBeNull()
  })

  it('never lets saved or draft check-in content reach Mầm (props, target, events, storage, requests, bubble)', async () => {
    const user = userEvent.setup()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const events: unknown[] = []
    const dispatch = window.dispatchEvent.bind(window)
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => {
      // A DOM node in a detail is not data; keep only its tag.
      const detail = (event as CustomEvent).detail
      events.push({
        type: event.type,
        detail: JSON.stringify(detail ?? null, (_key, value: unknown) =>
          value instanceof Element ? value.tagName : value,
        ),
      })
      return dispatch(event)
    })
    const writes: unknown[] = []
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      writes.push([key, value])
    })
    get.mockResolvedValue(record())
    targetCalls.args.length = 0

    render(<App />)
    await user.click(await screen.findByRole('button', { name: BUTTON }))
    const bubble = await screen.findByRole('dialog', { name: 'Mầm' })
    const registered = findMamTarget(card())?.target
    const savedSentinels = [
      SAVED_NOTE,
      SAVED_ID,
      'VERY_LOW',
      'Rất không tốt',
      'family',
      'Gia đình',
      '2026-10-29',
    ]
    const mamChannels = () =>
      JSON.stringify({
        props: cardButtonProps.seen,
        target: registered,
        events,
        writes,
        bubble: bubble.textContent,
      })
    for (const sentinel of savedSentinels)
      expect(mamChannels()).not.toContain(sentinel)

    // A draft: a different emotion and a note typed into the private context.
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('radio', { name: 'Rất tốt' }))
    await user.click(
      screen.getByText('Thêm bối cảnh riêng tư (không bắt buộc)'),
    )
    await user.type(
      screen.getByRole('textbox', { name: 'Ghi chú riêng (không bắt buộc)' }),
      DRAFT_NOTE,
    )
    expect(cardButton()).toBeNull()
    for (const sentinel of [...savedSentinels, DRAFT_NOTE, 'GREAT', 'Rất tốt'])
      expect(mamChannels()).not.toContain(sentinel)
    // Saved and draft phases alike: a kind-only descriptor, never a resolver.
    const descriptors = targetCalls.args.filter(([descriptor]) => descriptor)
    expect(descriptors.length).toBeGreaterThan(0)
    for (const args of descriptors)
      expect(args).toEqual([{ kind: 'home.emotion' }])
    expect(
      events.filter((event) =>
        String((event as { type: string }).type).startsWith('mam:'),
      ),
    ).toEqual([
      { type: 'mam:summon', detail: '{"source":"BUTTON","intent":"EXPLAIN"}' },
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})
