import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MasterDiplomaFullscreenModal from './MasterDiplomaFullscreenModal'

describe('MasterDiplomaFullscreenModal', () => {
  it('renders modal with academic verification data', () => {
    render(
      <MasterDiplomaFullscreenModal
        open={true}
        onClose={vi.fn()}
        specialistName="ThS. BS. Hồ Thị Hồng"
        specialistCode="#MB-482"
        diplomaNumber="MS-8812"
      />,
    )

    expect(
      screen.getByText('Bằng Thạc sĩ Tâm lý học lâm sàng #MS-8812'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Bộ GD&ĐT - Khớp 100%/)).toBeInTheDocument()
    expect(
      screen.getByText('ĐẠI HỌC Y DƯỢC THÀNH PHỐ HỒ CHÍ MINH'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Đã kiểm tra Chữ ký Hiệu trưởng ĐH Y Dược'),
    ).toBeInTheDocument()
  })

  it('triggers onConfirmVerified and onClose when confirming diploma', async () => {
    const user = userEvent.setup()
    const onConfirmVerified = vi.fn()
    const onClose = vi.fn()

    render(
      <MasterDiplomaFullscreenModal
        open={true}
        onClose={onClose}
        onConfirmVerified={onConfirmVerified}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: /Xác nhận Bằng Thạc sĩ hợp lệ/ }),
    )
    expect(onConfirmVerified).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('triggers onClose when clicking close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<MasterDiplomaFullscreenModal open={true} onClose={onClose} />)

    await user.click(
      screen.getByRole('button', { name: 'Đóng xem trước (ESC)' }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
