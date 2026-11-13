import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CchnFullscreenModal from './CchnFullscreenModal'

describe('CchnFullscreenModal', () => {
  it('renders modal when open is true with accurate clinical data', () => {
    render(
      <CchnFullscreenModal
        open={true}
        onClose={vi.fn()}
        specialistName="ThS. BS. Hồ Thị Hồng"
        specialistCode="#MB-482"
        cchnNumber="019283/BYT"
      />,
    )

    expect(
      screen.getByText('Chứng chỉ hành nghề KCB #019283/BYT'),
    ).toBeInTheDocument()
    expect(screen.getByText(/CSDL Quốc gia - Khớp 100%/)).toBeInTheDocument()
    expect(screen.getByText(/Tâm thần - Tâm lý lâm sàng/)).toBeInTheDocument()
    expect(
      screen.getByText('Đã kiểm tra Chữ ký số GĐ Sở Y tế'),
    ).toBeInTheDocument()
  })

  it('triggers onConfirmVerified and onClose when confirming verification', async () => {
    const user = userEvent.setup()
    const onConfirmVerified = vi.fn()
    const onClose = vi.fn()

    render(
      <CchnFullscreenModal
        open={true}
        onClose={onClose}
        onConfirmVerified={onConfirmVerified}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: /Xác nhận CCHN hợp lệ/ }),
    )
    expect(onConfirmVerified).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('triggers onClose when clicking close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<CchnFullscreenModal open={true} onClose={onClose} />)

    await user.click(
      screen.getByRole('button', { name: 'Đóng xem trước (ESC)' }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
