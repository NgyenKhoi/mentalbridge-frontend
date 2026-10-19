import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { CredentialDocument } from '../api/credential-validation'
import SpecialistCredentialViewer from './SpecialistCredentialViewer'

const client = vi.hoisted(() => ({ credentialFile: vi.fn() }))
vi.mock('../api/browser-client', () => ({ browserConsultation: client }))

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
    let resolveReload: (value: { data: { url: string } }) => void = () => {}
    client.credentialFile
      .mockResolvedValueOnce({ data: { url: 'https://files.test/a-1' } })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveReload = resolve
        }),
      )
      .mockResolvedValueOnce({ data: { url: 'https://files.test/b-1' } })

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
        'https://files.test/a-1',
      ),
    )
    await user.click(screen.getByRole('button', { name: /Tải lại/ }))
    await user.click(screen.getByRole('button', { name: /Bằng B/ }))
    await waitFor(() =>
      expect(screen.getByTitle('Bản gốc Bằng B')).toHaveAttribute(
        'src',
        'https://files.test/b-1',
      ),
    )

    await act(async () => {
      resolveReload({ data: { url: 'https://files.test/a-2' } })
    })

    expect(screen.getByTitle('Bản gốc Bằng B')).toHaveAttribute(
      'src',
      'https://files.test/b-1',
    )
  })
})
