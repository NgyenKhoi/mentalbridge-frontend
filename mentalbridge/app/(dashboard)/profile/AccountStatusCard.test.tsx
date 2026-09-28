import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AccountStatusCard } from './AccountStatusCard'

describe('AccountStatusCard', () => {
  it('renders section and heading properly', () => {
    render(<AccountStatusCard profileSaved={true} screeningEnabled={true} />)
    const section = screen.getByRole('region', { name: 'Trạng thái tài khoản' })
    expect(section).toBeInTheDocument()
    expect(screen.getByText('Trạng thái tài khoản')).toBeInTheDocument()
  })

  it('displays saved profile status and enabled screening', () => {
    render(<AccountStatusCard profileSaved={true} screeningEnabled={true} />)
    expect(screen.getByText('Hồ sơ cá nhân')).toBeInTheDocument()
    expect(screen.getByText('Thông tin đã sẵn sàng')).toBeInTheDocument()
    expect(screen.getByText('Đã lưu')).toBeInTheDocument()

    expect(screen.getByText('Xử lý dữ liệu sàng lọc')).toBeInTheDocument()
    expect(screen.getByText('Cho phép lưu lịch sử đánh giá')).toBeInTheDocument()
    expect(screen.getByText('Đang bật')).toBeInTheDocument()
  })

  it('displays unsaved profile status and disabled screening', () => {
    render(<AccountStatusCard profileSaved={false} screeningEnabled={false} />)
    expect(screen.getByText('Chưa hoàn tất thông tin')).toBeInTheDocument()
    expect(screen.getByText('Chưa lưu')).toBeInTheDocument()

    expect(screen.getByText('Không lưu kết quả vào tài khoản')).toBeInTheDocument()
    expect(screen.getByText('Đã tắt')).toBeInTheDocument()
  })
})
