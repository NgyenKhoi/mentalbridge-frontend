import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import SupportPlanDescription from './SupportPlanDescription'

describe('SupportPlanDescription', () => {
  it('renders explicit authored bullets as semantic lists without injecting HTML', () => {
    render(
      <SupportPlanDescription
        text={
          'Hướng dẫn đã duyệt.\n- Ý thứ nhất\n• Ý thứ hai\n<p>Nội dung dạng text</p>'
        }
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('<p>Nội dung dạng text</p>')).toBeVisible()
  })
  it('keeps ordinary prose together instead of splitting sentences into advice', () => {
    render(
      <SupportPlanDescription text="Đây là đoạn mô tả. Nội dung được giữ nguyên." />,
    )
    expect(
      screen.getByText('Đây là đoạn mô tả. Nội dung được giữ nguyên.'),
    ).toBeVisible()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
