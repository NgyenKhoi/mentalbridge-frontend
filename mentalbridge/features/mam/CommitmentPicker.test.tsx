import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import { CommitmentPicker } from './CommitmentPicker'
import { localToday, shiftLocalDate } from './companion-copy'
import { resetCompanionStateForTests } from './companion-state'

const created = (patch: object = {}) => ({
  id: '30000000-0000-4000-8000-000000000001',
  kind: 'MOVE',
  minutes: 5,
  dueOn: shiftLocalDate(localToday(), 1),
  source: 'CHAT',
  status: 'OPEN',
  createdAt: '2026-11-27T08:00:00.000Z',
  resolvedAt: null,
  ...patch,
})

describe('CommitmentPicker', () => {
  beforeEach(() => resetCompanionStateForTests())

  it('offers the seven kinds (no specialist step), the five durations and the two days as radio groups', () => {
    render(
      <CommitmentPicker
        accountId="acc-c1"
        source="CHAT"
        onCreated={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('radiogroup')).toHaveLength(3)
    expect(
      screen.getByRole('radiogroup', { name: 'Việc nhỏ nào?' }).children,
    ).toHaveLength(7)
    expect(
      screen.getByRole('radio', { name: '1 việc trong kế hoạch' }),
    ).toBeVisible()
    expect(screen.queryByText(/chuyên gia/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('radiogroup', { name: 'Trong bao lâu?' }).children,
    ).toHaveLength(5)
    expect(screen.getByRole('radio', { name: '5 phút' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Ngày mai' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Hẹn Mầm' })).toBeDisabled()
  })

  it('creates the lời hẹn with the chosen kind, minutes, local date and source', async () => {
    const user = userEvent.setup()
    let body: unknown = null
    mockServer.use(
      http.post('/api/companion-state/commitments', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(created({ kind: 'MOVE', minutes: 15 }), {
          status: 201,
        })
      }),
    )
    const onCreated = vi.fn()
    render(
      <CommitmentPicker
        accountId="acc-c2"
        source="CHAT"
        onCreated={onCreated}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'Vận động nhẹ' }))
    await user.click(screen.getByRole('radio', { name: '15 phút' }))
    await user.click(screen.getByRole('radio', { name: 'Hôm nay' }))
    await user.click(screen.getByRole('button', { name: 'Hẹn Mầm' }))

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
    expect(body).toEqual({
      kind: 'MOVE',
      minutes: 15,
      dueOn: localToday(),
      source: 'CHAT',
    })
    expect(onCreated.mock.calls[0][1]).toBe('today')
  })

  it('says three lời hẹn are already open on COMMITMENT_LIMIT, keeping the choice', async () => {
    const user = userEvent.setup()
    mockServer.use(
      http.post('/api/companion-state/commitments', () =>
        HttpResponse.json(
          {
            type: '/problems/commitment_limit',
            title: 'x',
            status: 409,
            code: 'COMMITMENT_LIMIT',
            correlationId: 'c',
          },
          { status: 409 },
        ),
      ),
    )
    const onCreated = vi.fn()
    render(
      <CommitmentPicker
        accountId="acc-c3"
        source="HOME"
        onCreated={onCreated}
        onCancel={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'Viết nhật ký' }))
    await user.click(screen.getByRole('button', { name: 'Hẹn Mầm' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn đang có 3 lời hẹn rồi, làm xong một cái rồi hẹn thêm nhé.',
    )
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: 'Viết nhật ký' })).toBeChecked()
  })

  it('says it was not saved on any other failure, and "Thôi" cancels', async () => {
    const user = userEvent.setup()
    mockServer.use(
      http.post('/api/companion-state/commitments', () => HttpResponse.error()),
    )
    const onCancel = vi.fn()
    render(
      <CommitmentPicker
        accountId="acc-c4"
        source="CHAT"
        onCreated={vi.fn()}
        onCancel={onCancel}
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'Thư giãn' }))
    await user.click(screen.getByRole('button', { name: 'Hẹn Mầm' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa lưu được lời hẹn. Bạn thử lại nhé.',
    )

    await user.click(screen.getByRole('button', { name: 'Thôi' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
