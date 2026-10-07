import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import AdminAuditLog from './AdminAuditLog'

const api = vi.hoisted(() => ({ browse: vi.fn(), exportCsv: vi.fn() }))
vi.mock('../api/browser-admin-audit', () => ({ browserAdminAudit: api }))

const event = {
  eventId: 'c8239c17-a472-4d72-a70b-a81322c40eb3',
  occurredAt: '2026-10-04T04:00:00Z',
  actorType: 'ADMIN' as const,
  actorIdentifier: 'account:948f9e80-d3bc-45aa-91f6-044dd5afbf78',
  action: 'ACCOUNT_DISABLED',
  result: 'DENIED' as const,
  reasonCode: 'POLICY_VIOLATION',
  correlationId: 'a9f3f920-eb85-4bc3-8782-9bc653131b25',
  sourceService: 'IDENTITY' as const,
  domain: 'ACCOUNT_ADMINISTRATION' as const,
  targetIdentifier: 'tombstone:' + 'a'.repeat(64),
}

const page = {
  items: [event],
  nextCursor: 'next-page',
  effectiveFrom: '2026-09-05T00:00:00Z',
  effectiveTo: '2026-10-05T00:00:00Z',
  retentionCutoff: '2025-10-05T00:00:00Z',
}

describe('AdminAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.browse.mockResolvedValue(page)
    api.exportCsv.mockResolvedValue(undefined)
  })

  it('renders only minimized audit metadata and a safe tombstone', async () => {
    render(<AdminAuditLog />)
    expect(
      await screen.findByText(/Đối tượng không còn khả dụng/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('cell', { name: /Quản trị viên/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('account:948f9e80-d3bc-45aa-91f6-044dd5afbf78'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/email|journal body|assessment answer/i),
    ).not.toBeInTheDocument()
  })

  it('renders deleted admin actor tombstone, system actor, and absent target safely', async () => {
    const deletedAdminEvent = {
      ...event,
      eventId: 'd8239c17-a472-4d72-a70b-a81322c40eb4',
      actorType: 'ADMIN' as const,
      actorIdentifier: 'tombstone:' + 'b'.repeat(64),
      targetIdentifier: null,
    }
    const systemEvent = {
      ...event,
      eventId: 'e8239c17-a472-4d72-a70b-a81322c40eb5',
      actorType: 'SYSTEM' as const,
      actorIdentifier: 'system',
      targetIdentifier: undefined,
    }
    api.browse.mockResolvedValueOnce({
      ...page,
      items: [deletedAdminEvent, systemEvent],
    })

    render(<AdminAuditLog />)
    expect(
      await screen.findByRole('cell', { name: /Hệ thống/ }),
    ).toBeInTheDocument()
    expect(screen.getByText('system')).toBeInTheDocument()
    expect(
      screen.getByText(/Tài khoản đã xóa · bbbbbbbbbbbb/),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Không áp dụng')).toHaveLength(2)
  })

  it('applies filters and reuses the applied filters for export', async () => {
    const user = userEvent.setup()
    render(<AdminAuditLog />)
    await screen.findByText('Tạm ngưng tài khoản')
    await user.selectOptions(screen.getByLabelText('Dịch vụ'), 'IDENTITY')
    await user.selectOptions(
      screen.getByLabelText('Phạm vi'),
      'ACCOUNT_ADMINISTRATION',
    )
    await user.selectOptions(screen.getByLabelText('Loại tác nhân'), 'ADMIN')
    await user.selectOptions(
      screen.getByLabelText('Hành động'),
      'ACCOUNT_DISABLED',
    )
    await user.selectOptions(screen.getByLabelText('Kết quả'), 'DENIED')
    await user.type(
      screen.getByLabelText('Mã đối tượng an toàn'),
      `tombstone:${'a'.repeat(64)}`,
    )
    await user.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }))

    const filters = {
      sourceService: 'IDENTITY',
      domain: 'ACCOUNT_ADMINISTRATION',
      actorType: 'ADMIN',
      action: 'ACCOUNT_DISABLED',
      result: 'DENIED',
      targetIdentifier: `tombstone:${'a'.repeat(64)}`,
    }
    await waitFor(() =>
      expect(api.browse).toHaveBeenLastCalledWith({ ...filters, limit: 50 }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Xuất CSV theo bộ lọc' }),
    )
    await waitFor(() => expect(api.exportCsv).toHaveBeenCalledWith(filters))
  })

  it('uses opaque cursor pagination', async () => {
    const user = userEvent.setup()
    render(<AdminAuditLog />)
    await screen.findByText('Tạm ngưng tài khoản')
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(api.browse).toHaveBeenLastCalledWith({
        cursor: 'next-page',
        limit: 50,
      }),
    )
  })

  it('shows a specific forbidden state', async () => {
    api.browse.mockRejectedValue(
      new ApiError({ message: 'Forbidden', code: 'FORBIDDEN', status: 403 }),
    )
    render(<AdminAuditLog />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn không có quyền xem nhật ký kiểm toán.',
    )
  })

  it.each([
    ['ACCOUNT_DISABLED', 'Tạm ngưng tài khoản'],
    ['ACCOUNT_RESTORED', 'Khôi phục tài khoản'],
    ['SPECIALIST_APPROVED', 'Duyệt chuyên gia'],
    ['SPECIALIST_REJECTED', 'Từ chối chuyên gia'],
    ['SPECIALIST_SUSPENDED', 'Đình chỉ chuyên gia'],
    ['SPECIALIST_RESTORED', 'Khôi phục chuyên gia'],
    ['RESOURCE_PUBLISHED', 'Xuất bản tài nguyên'],
    ['RESOURCE_ARCHIVED', 'Lưu trữ tài nguyên'],
    ['SAFETY_DIRECTORY_REVIEWED', 'Duyệt danh mục an toàn'],
    ['SAFETY_DIRECTORY_DEACTIVATED', 'Ngừng kích hoạt danh mục an toàn'],
    ['MODERATION_ACTION_APPLIED', 'Xử lý kiểm duyệt'],
    ['MODERATION_CASE_RESOLVED', 'Hoàn tất vụ việc kiểm duyệt'],
    ['COMMUNITY_POST_REMOVED', 'Gỡ bài viết cộng đồng'],
    ['COMMUNITY_USER_SUSPENDED', 'Đình chỉ người dùng cộng đồng'],
  ])(
    'supports selecting action %s with label %s',
    async (actionValue, expectedLabel) => {
      const user = userEvent.setup()
      render(<AdminAuditLog />)
      const select = screen.getByLabelText('Hành động')
      await user.selectOptions(select, actionValue)
      expect(select).toHaveValue(actionValue)
      expect(
        screen.getByRole('option', { name: expectedLabel }),
      ).toBeInTheDocument()
    },
  )
})
