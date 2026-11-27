import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SpecialistCredentialUploadDialog from './SpecialistCredentialUploadDialog'
import {
  extractCredentialFields,
  readCredentialFile,
  type CredentialReading,
} from '../services/credential-file-evidence'

vi.mock('../services/credential-file-evidence', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../services/credential-file-evidence')
  >()),
  readCredentialFile: vi.fn(),
}))

describe('SpecialistCredentialUploadDialog', () => {
  beforeEach(() => {
    vi.mocked(readCredentialFile)
      .mockReset()
      .mockResolvedValue({
        text: '',
        sources: [],
        pagesRead: 0,
        pageCount: 1,
        signatureFields: null,
        fields: extractCredentialFields(''),
      })
  })

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

  it.each(['unmount', 'close'] as const)(
    'aborts a pending credential read on %s and ignores its late rejection',
    async (exit) => {
      let signal: AbortSignal | undefined
      let rejectRead!: (error: Error) => void
      vi.mocked(readCredentialFile).mockImplementationOnce(
        (_file, nextSignal) => {
          signal = nextSignal
          return new Promise<CredentialReading>((_resolve, reject) => {
            rejectRead = reject
          })
        },
      )
      const user = userEvent.setup()
      const dialog = (open: boolean) => (
        <SpecialistCredentialUploadDialog
          open={open}
          onClose={vi.fn()}
          onUploaded={vi.fn()}
        />
      )
      const view = render(dialog(true))
      await user.upload(
        screen.getByLabelText(/Tệp gốc văn bằng \/ CCHN/),
        new File(['synthetic image'], 'credential.png', { type: 'image/png' }),
      )
      expect(signal?.aborted).toBe(false)
      if (exit === 'unmount') view.unmount()
      else view.rerender(dialog(false))
      expect(signal?.aborted).toBe(true)
      await act(async () => rejectRead(new Error('Cancelled read')))
    },
  )
})
