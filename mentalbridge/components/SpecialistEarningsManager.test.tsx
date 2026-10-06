import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import SpecialistEarningsManager from './SpecialistEarningsManager'

describe('SpecialistEarningsManager', () => {
  it('renders an honest unavailable state without demo financial values', () => {
    render(<SpecialistEarningsManager />)

    expect(
      screen.getByRole('heading', {
        name: 'Chưa có dữ liệu tài chính để hiển thị',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/không ước tính hoặc dùng số mẫu/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/8\.400\.000/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Vietcombank|PayOS/i)).not.toBeInTheDocument()
  })
})
