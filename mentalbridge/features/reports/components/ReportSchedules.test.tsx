import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReportSchedules } from './ReportSchedules'

const schedule = {
  scheduleId: 'a2464b2b-a7fd-46fd-9310-64ef4eac7de7',
  reportType: 'ACCOUNT_ACTIVITY',
  cadence: 'WEEKLY',
  timezone: 'Asia/Ho_Chi_Minh',
  localTime: '08:00:00',
  periodDays: 7,
  recipientGroup: 'ADMIN',
  deliveryTarget: 'ADMIN_REPORT_HISTORY',
  status: 'ACTIVE',
  nextRunAt: '2026-10-12T01:00:00Z',
  lastFailureCode: null,
  createdAt: '2026-10-09T00:00:00Z',
  updatedAt: '2026-10-09T00:00:00Z',
  version: 0,
}
function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}
afterEach(() => vi.unstubAllGlobals())

describe('ReportSchedules', () => {
  it('creates a schedule with the approved ADMIN in-app destination', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, options?: RequestInit) =>
        options?.method === 'POST' ? json(schedule, 201) : json([]),
      ),
    )
    const user = userEvent.setup()
    render(<ReportSchedules onNotice={vi.fn()} onRefreshReports={vi.fn()} />)
    await screen.findByText(/Chưa có lịch báo cáo/)
    await user.click(screen.getByRole('button', { name: 'Tạo lịch' }))
    await screen.findByText('Đã lưu lịch báo cáo.')
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([, options]) => options?.method === 'POST')
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      reportType: 'ACCOUNT_ACTIVITY',
      cadence: 'WEEKLY',
      timezone: 'Asia/Ho_Chi_Minh',
      localTime: '08:00',
      periodDays: 7,
      recipientGroup: 'ADMIN',
      deliveryTarget: 'ADMIN_REPORT_HISTORY',
      enabled: true,
    })
  })

  it('pauses, resumes, edits and deletes using the current revision', async () => {
    let current = { ...schedule }
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, options?: RequestInit) => {
        if (options?.method === 'PUT') {
          const body = JSON.parse(String(options.body))
          current = {
            ...current,
            ...body,
            status: body.enabled ? 'ACTIVE' : 'PAUSED',
            version: current.version + 1,
          }
          return json(current)
        }
        if (options?.method === 'DELETE') return json(null, 204)
        return json([current])
      }),
    )
    const user = userEvent.setup()
    render(<ReportSchedules onNotice={vi.fn()} onRefreshReports={vi.fn()} />)
    await user.click(
      await screen.findByRole('button', { name: /Tạm dừng lịch/ }),
    )
    await user.click(
      await screen.findByRole('button', { name: /Tiếp tục lịch/ }),
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Sửa lịch/ })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: /Sửa lịch/ }))
    await user.clear(screen.getByLabelText('Số ngày tổng hợp'))
    await user.type(screen.getByLabelText('Số ngày tổng hợp'), '30')
    await user.click(screen.getByRole('button', { name: 'Lưu lịch' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Xóa lịch/ })).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: /Xóa lịch/ }))
    await screen.findByText(/Đã xóa lịch/)
    const writes = vi
      .mocked(fetch)
      .mock.calls.filter(([, options]) => options?.method)
    expect(
      writes.map(([url]) => String(url).split('expectedVersion=')[1]),
    ).toEqual(['0', '1', '2', '3'])
  })

  it('keeps the authoritative pause result and locks writes when reconciliation fails', async () => {
    const paused = { ...schedule, status: 'PAUSED', version: 1 }
    let reads = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, options?: RequestInit) => {
        if (options?.method === 'PUT') return json(paused)
        reads += 1
        if (reads === 1) return json([schedule])
        if (reads === 2) return json({}, 503)
        return json([paused])
      }),
    )
    const user = userEvent.setup()
    render(<ReportSchedules onNotice={vi.fn()} onRefreshReports={vi.fn()} />)

    await user.click(
      await screen.findByRole('button', { name: /Tạm dừng lịch/ }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Đã lưu lịch, nhưng danh sách chưa được cập nhật đầy đủ',
    )
    expect(
      screen.queryByRole('button', { name: /Tạm dừng lịch/ }),
    ).not.toBeInTheDocument()
    const resume = screen.getByRole('button', { name: /Tiếp tục lịch/ })
    expect(resume).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tạo lịch' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Tải lại' }))
    await waitFor(() => expect(resume).toBeEnabled())
  })

  it('represents a committed create exactly once and prevents another create when reconciliation fails', async () => {
    let reads = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, options?: RequestInit) => {
        if (options?.method === 'POST') return json(schedule, 201)
        reads += 1
        return reads === 1 ? json([]) : json({}, 503)
      }),
    )
    const user = userEvent.setup()
    render(<ReportSchedules onNotice={vi.fn()} onRefreshReports={vi.fn()} />)
    await screen.findByText(/Chưa có lịch báo cáo/)

    await user.click(screen.getByRole('button', { name: 'Tạo lịch' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Đã lưu lịch, nhưng danh sách chưa được cập nhật đầy đủ',
    )
    expect(
      screen.getAllByRole('button', { name: /Tạm dừng lịch/ }),
    ).toHaveLength(1)
    expect(screen.queryByText(/Chưa có lịch báo cáo/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tạo lịch' })).toBeDisabled()
  })

  it('removes a committed delete and prevents stale actions when reconciliation fails', async () => {
    let reads = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, options?: RequestInit) => {
        if (options?.method === 'DELETE') return json(null, 204)
        reads += 1
        return reads === 1 ? json([schedule]) : json({}, 503)
      }),
    )
    const user = userEvent.setup()
    render(<ReportSchedules onNotice={vi.fn()} onRefreshReports={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: /Xóa lịch/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Đã xóa lịch, nhưng danh sách chưa được cập nhật đầy đủ',
    )
    expect(
      screen.queryByRole('button', { name: /Xóa lịch Hàng tuần/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Chưa có lịch báo cáo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tạo lịch' })).toBeDisabled()
  })

  it('keeps the draft after failure and reloads a stale schedule', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, options?: RequestInit) =>
        options?.method === 'PUT' ? json({}, 412) : json([schedule]),
      ),
    )
    const user = userEvent.setup()
    render(<ReportSchedules onNotice={vi.fn()} onRefreshReports={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: /Sửa lịch/ }))
    await user.click(screen.getByRole('button', { name: 'Lưu lịch' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Lịch đã thay đổi',
    )
    expect(screen.getByLabelText('Múi giờ')).toHaveValue('Asia/Ho_Chi_Minh')
  })
})
