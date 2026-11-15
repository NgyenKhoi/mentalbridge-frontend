import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import SpecialistCredentialUploadDialog from './SpecialistCredentialUploadDialog'

describe('SpecialistCredentialUploadDialog', () => {
  it('keeps entered details and shows pending review when a license file is selected', async () => {
    const user = userEvent.setup()
    render(
      <SpecialistCredentialUploadDialog
        open
        onClose={vi.fn()}
        onUploaded={vi.fn()}
      />,
    )

    await user.selectOptions(screen.getByLabelText('Loại giấy tờ'), 'LICENSE')
    await user.type(
      screen.getByLabelText('Tên giấy tờ'),
      'Giấy phép thử nghiệm',
    )
    await user.upload(
      screen.getByLabelText(/Tệp gốc văn bằng \/ CCHN/),
      new File(['%PDF- fake fixture'], 'cchn-gia.pdf', {
        type: 'application/pdf',
      }),
    )

    expect(screen.getByLabelText('Tên giấy tờ')).toHaveValue(
      'Giấy phép thử nghiệm',
    )
    expect(screen.getByLabelText('Nơi cấp')).toHaveValue('')
    expect(screen.getByText(/chờ xác minh sau khi tải lên/i)).toBeVisible()
    expect(screen.queryByText(/PaddleOCR|CCHN hợp lệ/i)).toBeNull()
  })
})
