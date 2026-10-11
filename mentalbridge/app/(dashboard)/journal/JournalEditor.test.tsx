import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import JournalPage from './page'

const clientEntryId = '50000000-0000-4000-8000-000000000001'
const commandKey = '60000000-0000-4000-8000-000000000001'

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type':
        status >= 400 ? 'application/problem+json' : 'application/json',
    },
  })
}

describe('Journal editor redesign', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce(clientEntryId)
      .mockReturnValue(commandKey)

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        json({ items: [], page: { limit: 20, hasMore: false } }),
      )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders all 5 moods and toggles supportive banner on LOW and VERY_LOW moods', async () => {
    const user = userEvent.setup()
    render(<JournalPage />)

    const open = await screen.findByRole('button', {
      name: 'Viết nhật ký mới',
    })
    await user.click(open)

    const modal = within(screen.getByRole('dialog'))

    // All 5 mood radios exist
    expect(modal.getByRole('radio', { name: 'Tuyệt vời' })).toBeInTheDocument()
    expect(modal.getByRole('radio', { name: 'Tốt' })).toBeInTheDocument()
    expect(
      modal.getByRole('radio', { name: 'Bình thường' }),
    ).toBeInTheDocument()
    expect(modal.getByRole('radio', { name: 'Không tốt' })).toBeInTheDocument()
    expect(modal.getByRole('radio', { name: 'Rất tệ' })).toBeInTheDocument()

    // Initially support banner is not visible
    expect(
      modal.queryByText(/Có những ngày cảm xúc trở nên nặng nề hơn/),
    ).not.toBeInTheDocument()

    // Select LOW mood
    await user.click(modal.getByRole('radio', { name: 'Không tốt' }))
    expect(
      modal.getByText(/Có những ngày cảm xúc trở nên nặng nề hơn/),
    ).toBeInTheDocument()
    expect(
      modal.getByRole('link', { name: 'kết nối với chuyên gia' }),
    ).toHaveAttribute('href', '/specialists')

    // Switch to GREAT mood -> banner disappears
    await user.click(modal.getByRole('radio', { name: 'Tuyệt vời' }))
    expect(
      modal.queryByText(/Có những ngày cảm xúc trở nên nặng nề hơn/),
    ).not.toBeInTheDocument()

    // Switch to VERY_LOW mood -> banner appears
    await user.click(modal.getByRole('radio', { name: 'Rất tệ' }))
    expect(
      modal.getByText(/Có những ngày cảm xúc trở nên nặng nề hơn/),
    ).toBeInTheDocument()
  })

  it('rotates prompts and clicking a prompt appends it to textarea', async () => {
    const user = userEvent.setup()
    render(<JournalPage />)

    await user.click(
      await screen.findByRole('button', { name: 'Viết nhật ký mới' }),
    )
    const modal = within(screen.getByRole('dialog'))

    // Select positive mood
    await user.click(modal.getByRole('radio', { name: 'Tuyệt vời' }))
    expect(
      modal.getByText('Ghi lại những điều tích cực hôm nay'),
    ).toBeInTheDocument()

    // Find first prompt chip and click it
    const prompt1 =
      'Điều gì đã khiến bạn mỉm cười hoặc cảm thấy biết ơn hôm nay?'
    const promptChip = modal.getByText(prompt1)
    await user.click(promptChip)

    const textarea = modal.getByLabelText('Nội dung')
    expect(textarea).toHaveValue(prompt1 + '\n')
    expect(textarea).toHaveFocus()

    // Rotate prompts
    const rotateBtn = modal.getByRole('button', { name: 'Đổi gợi ý khác' })
    await user.click(rotateBtn)
    const promptSection = within(
      modal.getByRole('region', {
        name: 'Ghi lại những điều tích cực hôm nay',
      }),
    )
    expect(promptSection.queryByText(prompt1)).not.toBeInTheDocument()
  })

  it('toggles preset tags and shows tag count', async () => {
    const user = userEvent.setup()
    render(<JournalPage />)

    await user.click(
      await screen.findByRole('button', { name: 'Viết nhật ký mới' }),
    )
    const modal = within(screen.getByRole('dialog'))

    expect(modal.getByText('0/20 thẻ')).toBeInTheDocument()

    // Click preset chip "Công việc"
    await user.click(modal.getByRole('button', { name: 'Công việc' }))
    expect(modal.getByText('1/20 thẻ')).toBeInTheDocument()
    expect(modal.getByText('#Công việc')).toBeInTheDocument()

    // Click preset chip "Sức khỏe"
    await user.click(modal.getByRole('button', { name: 'Sức khỏe' }))
    expect(modal.getByText('2/20 thẻ')).toBeInTheDocument()
    expect(modal.getByText('#Sức khỏe')).toBeInTheDocument()

    // Delete tag using chip remove button
    const deleteBtn = modal.getByRole('button', { name: 'Xóa thẻ Công việc' })
    await user.click(deleteBtn)
    expect(modal.getByText('1/20 thẻ')).toBeInTheDocument()
    expect(modal.queryByText('#Công việc')).not.toBeInTheDocument()
  })

  it('resets occurredAt to current time with "Bây giờ" button', async () => {
    const user = userEvent.setup()
    render(<JournalPage />)

    await user.click(
      await screen.findByRole('button', { name: 'Viết nhật ký mới' }),
    )
    const modal = within(screen.getByRole('dialog'))

    const dateInput = modal.getByLabelText('Thời điểm ghi')
    await user.clear(dateInput)
    await user.type(dateInput, '2026-09-01T10:00')
    expect(dateInput).toHaveValue('2026-09-01T10:00')

    const nowBtn = modal.getByRole('button', { name: 'Bây giờ' })
    await user.click(nowBtn)
    expect(dateInput).not.toHaveValue('2026-09-01T10:00')
  })
})
