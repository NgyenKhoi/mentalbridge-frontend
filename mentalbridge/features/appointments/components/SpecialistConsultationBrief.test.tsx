import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { SpecialistConsultationBrief } from './SpecialistConsultationBrief'

const api = vi.hoisted(() => ({ specialist: vi.fn() }))
vi.mock('../api/consultation-brief-browser-client', () => ({
  consultationBriefBrowserClient: api,
}))
const brief = {
  currentSituation: 'Nội dung được phê duyệt',
  userGoals: ['Mục tiêu trao đổi'],
  screeningContext: [],
}

describe('SpecialistConsultationBrief disclosure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.specialist.mockResolvedValue(brief)
  })

  it('loads only when opened and revalidates permission after being collapsed', async () => {
    const user = userEvent.setup()
    api.specialist.mockResolvedValueOnce(brief).mockRejectedValueOnce(
      new ApiError({
        code: 'CONSULTATION_BRIEF_ACCESS_DENIED',
        status: 403,
        message: 'denied',
      }),
    )
    render(<SpecialistConsultationBrief appointmentId="appointment" />)
    expect(api.specialist).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Xem tóm tắt' }))
    expect(await screen.findByText(brief.currentSituation)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thu gọn tóm tắt' }))
    await waitFor(() =>
      expect(
        screen.queryByText(brief.currentSituation),
      ).not.toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: 'Xem tóm tắt' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'chưa phê duyệt hoặc đã thu hồi',
    )
    expect(screen.queryByText(brief.currentSituation)).not.toBeInTheDocument()
    expect(api.specialist).toHaveBeenCalledTimes(2)
  })
})
