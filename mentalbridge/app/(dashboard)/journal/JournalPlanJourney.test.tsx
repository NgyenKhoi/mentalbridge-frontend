import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResolvedJournalPlanOrigin } from '@/features/support-plan/journal-plan-origin'
import { emotionOccurrenceFixture } from '@/features/support-plan/testing/native-support-plan-fixture'
import JournalPage from './page'

const hints = vi.hoisted(() => ({
  query: '',
  resolve: vi.fn(),
  confirm: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(hints.query),
}))
vi.mock('@/features/support-plan/journal-plan-origin', async (original) => ({
  ...(await original<
    typeof import('@/features/support-plan/journal-plan-origin')
  >()),
  resolveJournalPlanOrigin: hints.resolve,
}))
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => ({ showActionToast: hints.toast, confirm: hints.confirm }),
}))

const occurrenceId = '30000000-0000-4000-8000-000000000642'
const actionId = '20000000-0000-4000-8000-000000000642'
const entryId = '70000000-0000-4000-8000-000000000642'
const query = `source=journal&occurrenceId=${occurrenceId}&actionId=${actionId}&localDate=2026-10-14`
const expectedReturn = `/support-plan?${query}&journalId=${entryId}#activity-${occurrenceId}`
function origin(
  overrides: Partial<ResolvedJournalPlanOrigin> = {},
): ResolvedJournalPlanOrigin {
  return {
    source: 'journal',
    occurrenceId,
    actionId,
    localDate: '2026-10-14',
    timezone: 'Asia/Ho_Chi_Minh',
    title: 'Viết một suy nghĩ ngắn',
    planId: '10000000-0000-4000-8000-000000000641',
    planStatus: 'ACTIVE',
    actionStatus: 'ACTIVE',
    activatedAt: '2026-10-13T05:00:00Z',
    canOpenWriting: true,
    occurrence: {
      ...emotionOccurrenceFixture(),
      occurrenceId,
      actionId,
      actionType: 'JOURNAL',
      localDate: '2026-10-14',
    },
    ...overrides,
  }
}
function entry(text: string, revision = 1) {
  return {
    id: entryId,
    ownerAccountId: '10000000-0000-4000-8000-000000000001',
    currentRevision: revision,
    occurredAt: '2026-10-13T10:00:00Z',
    createdAt: '2026-10-14T12:00:00Z',
    updatedAt: '2026-10-14T12:00:00Z',
    deleted: false,
    tags: ['đi dạo'],
    mood: 'GOOD',
    encryption: {
      algorithm: 'AES-256-GCM',
      keyId: 'test-v1',
      encryptedAt: '2026-10-14T12:00:00Z',
    },
    analysisState: 'not_requested',
    content: { text, byteLength: new TextEncoder().encode(text).byteLength },
  }
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function setupFetch({ failCreate = false } = {}) {
  let posts = 0
  const fetcher = vi.fn<typeof fetch>(async (url, options) => {
    if (url === '/api/journals' && options?.method === 'POST') {
      posts++
      if (failCreate && posts === 1)
        return json({ code: 'JOURNAL_MUTATION_OUTCOME_UNKNOWN' }, 503)
      return json(entry('Những suy nghĩ riêng tư của tôi.'), 201)
    }
    if (url === `/api/journals/${entryId}` && options?.method === 'PATCH')
      return json(entry('Bài cũ đã chỉnh sửa.', 2))
    if (url === `/api/journals/${entryId}`) return json(entry('Bài cũ đã lưu.'))
    if (url === '/api/journals')
      return json({ items: [], page: { limit: 20, hasMore: false } })
    return json({ code: 'RESOURCE_NOT_FOUND' }, 404)
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
async function fillEditor(user: ReturnType<typeof userEvent.setup>) {
  const dialog = within(
    await screen.findByRole('dialog', undefined, { timeout: 5_000 }),
  )
  // The canonical editor focuses its heading on the next animation frame.
  // Wait for that focus handoff before typing so it cannot steal the keystrokes.
  await waitFor(() =>
    expect(dialog.getByRole('heading', { name: 'Viết nhật ký' })).toHaveFocus(),
  )
  await user.type(
    dialog.getByLabelText('Nội dung'),
    'Những suy nghĩ riêng tư của tôi.',
  )
  await user.click(dialog.getByRole('radio', { name: 'Tốt' }))
  await user.type(dialog.getByLabelText('Thẻ do bạn đặt'), 'đi dạo')
  expect(dialog.getByLabelText('Nội dung')).toHaveValue(
    'Những suy nghĩ riêng tư của tôi.',
  )
  expect(dialog.getByRole('radio', { name: 'Tốt' })).toBeChecked()
  expect(dialog.getByLabelText('Thẻ do bạn đặt')).toHaveValue('đi dạo')
  return dialog
}

describe('Journal canonical plan handoff', () => {
  beforeEach(() => {
    vi.spyOn(window.history, 'back').mockImplementation(() => {})
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-14T12:00:00Z'))
    hints.query = query
    hints.resolve.mockReset().mockResolvedValue(origin())
    hints.confirm.mockReset().mockResolvedValue(false)
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '90000000-0000-4000-8000-000000000642',
    )
  })
  afterEach(() => {
    // Unmount while history.back is still mocked; restoring the spy first lets
    // the draft guard's cleanup enqueue real jsdom history work in the next case.
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('opens the canonical editor, saves an owner-returned candidate and explicitly returns without reconciling', async () => {
    const fetcher = setupFetch(),
      user = userEvent.setup()
    render(<JournalPage />)
    const dialog = await fillEditor(user)
    expect(
      dialog.getByText('Từ kế hoạch · Viết một suy nghĩ ngắn'),
    ).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Lưu nhật ký' }))
    const back = await dialog.findByRole('link', { name: 'Quay lại hoạt động' })
    await waitFor(() => expect(back).toHaveAttribute('href', expectedReturn))
    expect(dialog.getByRole('status')).toHaveTextContent(
      'việc lưu bài chưa tự xác nhận hoàn thành',
    )
    const postCount = fetcher.mock.calls.filter(
      ([, options]) => options?.method === 'POST',
    ).length
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(postCount)
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes('/reconcile')),
    ).toBe(false)
    expect(back.getAttribute('href')).not.toMatch(/Những|text|mood|tags/)
  })

  it('preserves inputs and the logical create key after unknown outcome, then uses only the returned ID', async () => {
    const fetcher = setupFetch({ failCreate: true }),
      user = userEvent.setup()
    render(<JournalPage />)
    const dialog = await fillEditor(user)
    await user.click(dialog.getByRole('button', { name: 'Lưu nhật ký' }))
    await dialog.findByRole('alert')
    expect(dialog.getByLabelText('Nội dung')).toHaveValue(
      'Những suy nghĩ riêng tư của tôi.',
    )
    expect(dialog.getByRole('radio', { name: 'Tốt' })).toBeChecked()
    expect(dialog.getByLabelText('Thẻ do bạn đặt')).toHaveValue('đi dạo')
    await user.click(dialog.getByRole('button', { name: 'Lưu nhật ký' }))
    await waitFor(() =>
      expect(
        dialog.getByRole('link', { name: 'Quay lại hoạt động' }),
      ).toHaveAttribute('href', expectedReturn),
    )
    const posts = fetcher.mock.calls.filter(
      ([, options]) => options?.method === 'POST',
    )
    expect(posts).toHaveLength(2)
    expect(posts[0][1]?.headers).toEqual(posts[1][1]?.headers)
    expect(posts[0][1]?.body).toEqual(posts[1][1]?.body)
  })

  it('does not remount or retarget a dirty editor when query context changes during writing', async () => {
    setupFetch()
    const user = userEvent.setup(),
      view = render(<JournalPage />)
    const dialog = await fillEditor(user)
    hints.query = query.replace(
      occurrenceId,
      '30000000-0000-4000-8000-000000000643',
    )
    hints.resolve.mockResolvedValue(
      origin({
        occurrenceId: '30000000-0000-4000-8000-000000000643',
        title: 'Hoạt động khác',
      }),
    )
    view.rerender(<JournalPage />)
    await waitFor(() => expect(hints.resolve).toHaveBeenCalledTimes(2))
    expect(dialog.getByLabelText('Nội dung')).toHaveValue(
      'Những suy nghĩ riêng tư của tôi.',
    )
    expect(
      dialog.queryByText('Từ kế hoạch · Hoạt động khác'),
    ).not.toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Lưu nhật ký' }))
    await waitFor(() =>
      expect(
        dialog.getByRole('link', { name: 'Quay lại hoạt động' }),
      ).toHaveAttribute('href', expectedReturn),
    )
  })

  it('existing-entry revisions do not create or promote a new completion candidate', async () => {
    hints.query = `${query}&journalId=${entryId}`
    hints.resolve.mockResolvedValue(
      origin({ journalId: entryId, canOpenWriting: false }),
    )
    const fetcher = setupFetch(),
      user = userEvent.setup()
    render(<JournalPage />)
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(await dialog.findByRole('button', { name: 'Chỉnh sửa' }))
    await user.type(dialog.getByLabelText('Nội dung'), ' thêm')
    await user.click(dialog.getByRole('button', { name: 'Lưu nhật ký' }))
    await dialog.findByRole('button', { name: 'Chỉnh sửa' })
    expect(
      fetcher.mock.calls.filter(([, options]) => options?.method === 'POST'),
    ).toHaveLength(0)
    expect(
      dialog.queryByText(/Đã lưu nhật ký. Quay lại hoạt động/),
    ).not.toBeInTheDocument()
    expect(
      dialog.getByRole('link', { name: 'Quay lại hoạt động' }),
    ).toHaveAttribute('href', expectedReturn)
  })
  it('does not carry a previous saved return into a newly opened query-driven entry', async () => {
    const fetcher = setupFetch()
    const user = userEvent.setup()
    const view = render(<JournalPage />)
    const dialog = await fillEditor(user)
    const nextOccurrence = '30000000-0000-4000-8000-000000000643'
    const nextAction = '20000000-0000-4000-8000-000000000643'
    const nextEntry = '70000000-0000-4000-8000-000000000643'
    hints.query = `source=journal&occurrenceId=${nextOccurrence}&actionId=${nextAction}&localDate=2026-10-14&journalId=${nextEntry}`
    hints.resolve.mockResolvedValue(
      origin({
        occurrenceId: nextOccurrence,
        actionId: nextAction,
        journalId: nextEntry,
        title: 'Hoạt động khác',
      }),
    )
    view.rerender(<JournalPage />)
    await waitFor(() => expect(hints.resolve).toHaveBeenCalledTimes(2))
    await user.click(dialog.getByRole('button', { name: 'Lưu nhật ký' }))
    await waitFor(() =>
      expect(
        dialog.getByRole('link', { name: 'Quay lại hoạt động' }),
      ).toHaveAttribute('href', expectedReturn),
    )
    fetcher.mockImplementation(async () =>
      json({ ...entry('Bài đã chọn khác.'), id: nextEntry }),
    )
    await user.click(dialog.getByRole('button', { name: 'Đóng' }))
    await screen.findByText('Bài đã chọn khác.')
    const nextDialog = within(screen.getByRole('dialog'))
    expect(nextDialog.getByText('Từ kế hoạch · Hoạt động khác')).toBeVisible()
    expect(
      nextDialog.getByRole('link', { name: 'Quay lại hoạt động' }),
    ).toHaveAttribute(
      'href',
      `/support-plan?${hints.query}#activity-${nextOccurrence}`,
    )
  })

  it.each(['malformed', 'unavailable'])(
    'keeps ordinary Journal usable when origin is %s',
    async (kind) => {
      if (kind === 'malformed') hints.query = 'source=journal&actionId=invalid'
      else hints.resolve.mockRejectedValue(new Error('unavailable'))
      setupFetch()
      const user = userEvent.setup()
      render(<JournalPage />)
      await screen.findByText(
        'Chưa mở được hoạt động từ kế hoạch. Nhật ký riêng vẫn sử dụng bình thường.',
      )
      await user.click(screen.getByRole('button', { name: 'Viết nhật ký mới' }))
      const dialog = within(screen.getByRole('dialog'))
      expect(dialog.getByLabelText('Nội dung')).toBeVisible()
      expect(dialog.queryByText(/Từ kế hoạch/)).not.toBeInTheDocument()
    },
  )

  it('uses shared confirmation for dirty close/return and retains all fields when staying', async () => {
    setupFetch()
    const user = userEvent.setup()
    render(<JournalPage />)
    const dialog = await fillEditor(user)
    await user.click(dialog.getByRole('button', { name: 'Đóng' }))
    await waitFor(() => expect(hints.confirm).toHaveBeenCalled())
    expect(dialog.getByLabelText('Nội dung')).toHaveValue(
      'Những suy nghĩ riêng tư của tôi.',
    )
    hints.confirm.mockResolvedValue(true)
    await user.click(dialog.getByRole('button', { name: 'Đóng' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('explains a different schedule-local day without attaching an ordinary new entry', async () => {
    hints.resolve.mockResolvedValue(origin({ localDate: '2026-10-13' }))
    setupFetch()
    const user = userEvent.setup()
    render(<JournalPage />)
    await screen.findByText(
      'Bạn vẫn có thể viết nhật ký riêng. Bài mới không ghi nhận thay cho hoạt động của ngày khác hoặc hoạt động đã hoàn thành.',
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Viết nhật ký mới' }))
    expect(
      within(screen.getByRole('dialog')).queryByText(/Từ kế hoạch/),
    ).not.toBeInTheDocument()
  })
})
