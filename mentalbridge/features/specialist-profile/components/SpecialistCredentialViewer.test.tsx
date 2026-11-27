import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BrowserConsultationError } from '../api/browser-client'
import type { CredentialDocument } from '../api/credential-validation'
import SpecialistCredentialViewer from './SpecialistCredentialViewer'

const client = vi.hoisted(() => ({ credentialFile: vi.fn() }))
vi.mock('../api/browser-client', async (original) => ({
  ...(await original<typeof import('../api/browser-client')>()),
  browserConsultation: client,
}))

const pdf = () => new Blob(['%PDF-1.5'], { type: 'application/pdf' })
const createObjectURL = vi.fn()
const revokeObjectURL = vi.fn()

beforeEach(() => {
  client.credentialFile.mockReset()
  createObjectURL.mockReset()
  revokeObjectURL.mockReset()
  vi.stubGlobal(
    'URL',
    Object.assign(class extends URL {}, {
      createObjectURL,
      revokeObjectURL,
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function credential(id: string, title: string) {
  return {
    id,
    title,
    credentialType: 'DEGREE',
    verificationStatus: 'PENDING',
    issuer: 'Đại học',
    issueYear: 2020,
    fileName: `${id}.pdf`,
    fileBytes: 1024,
  } as unknown as CredentialDocument
}

describe('SpecialistCredentialViewer', () => {
  it('never shows a late reload of one document under another document', async () => {
    const user = userEvent.setup()
    let resolveReload: (value: Blob) => void = () => {}
    createObjectURL
      .mockReturnValueOnce('blob:http://localhost/a-1')
      .mockReturnValueOnce('blob:http://localhost/b-1')
    client.credentialFile
      .mockResolvedValueOnce(pdf())
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveReload = resolve
        }),
      )
      .mockResolvedValueOnce(pdf())

    render(
      <SpecialistCredentialViewer
        open
        onClose={() => {}}
        documents={[credential('a', 'Bằng A'), credential('b', 'Bằng B')]}
        selectedId="a"
      />,
    )

    await waitFor(() =>
      expect(screen.getByTitle('Bản gốc Bằng A')).toHaveAttribute(
        'src',
        'blob:http://localhost/a-1',
      ),
    )
    await user.click(screen.getByRole('button', { name: /Tải lại/ }))
    await user.click(screen.getByRole('button', { name: /Bằng B/ }))
    await waitFor(() =>
      expect(screen.getByTitle('Bản gốc Bằng B')).toHaveAttribute(
        'src',
        'blob:http://localhost/b-1',
      ),
    )

    await act(async () => {
      resolveReload(pdf())
    })

    expect(screen.getByTitle('Bản gốc Bằng B')).toHaveAttribute(
      'src',
      'blob:http://localhost/b-1',
    )
    expect(createObjectURL).toHaveBeenCalledTimes(2)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/a-1')
  })

  it('shows a retry message for rate limits and downloads the loaded file', async () => {
    const user = userEvent.setup()
    client.credentialFile
      .mockRejectedValueOnce(new BrowserConsultationError(429, 'BUSY', 'error'))
      .mockResolvedValueOnce(pdf())
    createObjectURL.mockReturnValue('blob:http://localhost/a-1')
    render(
      <SpecialistCredentialViewer
        open
        onClose={() => {}}
        documents={[credential('a', 'Bằng A')]}
        selectedId="a"
      />,
    )

    expect(await screen.findByText(/Hãy đợi một lúc/)).toBeVisible()
    expect(screen.queryByTitle('Bản gốc Bằng A')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tải xuống' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Tải lại' }))
    const link = await screen.findByRole('link', { name: 'Tải xuống' })
    expect(link).toHaveAttribute('download', 'a.pdf')
    expect(link).toHaveAttribute('href', 'blob:http://localhost/a-1')
    expect(client.credentialFile).toHaveBeenCalledTimes(2)
  })
})
