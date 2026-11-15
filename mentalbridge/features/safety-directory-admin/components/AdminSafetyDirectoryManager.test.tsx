import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import type { SafetyDirectoryAdminEntry } from '@/lib/api/admin-safety-directory'

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  transition: vi.fn(),
}))
const confirm = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/admin-safety-directory', () => ({
  adminSafetyDirectoryApi: api,
}))
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => ({
    confirm,
    showActionToast: vi.fn(),
  }),
}))

import AdminSafetyDirectoryManager from './AdminSafetyDirectoryManager'

const entry: SafetyDirectoryAdminEntry = {
  directoryEntryId: '123e4567-e89b-42d3-a456-426614174000',
  name: 'Đường dây hỗ trợ quốc gia',
  type: 'HOTLINE',
  phone: '111',
  address: null,
  coverage: [
    {
      level: 'NATIONWIDE',
      provinceCode: null,
      provinceName: null,
      districtCode: null,
      districtName: null,
    },
  ],
  sourceName: 'Nguồn chính thức',
  sourceReference: 'Công văn 01',
  reviewedAt: '2026-11-10T00:00:00Z',
  verifiedAt: '2026-11-10T00:00:00Z',
  recordVersion: 3,
  active: true,
  reviewState: 'CURRENT',
  reviewedBy: '123e4567-e89b-42d3-a456-426614174001',
  verifiedBy: '123e4567-e89b-42d3-a456-426614174002',
  sourceRetrievedAt: '2026-11-09T00:00:00Z',
  sourceChecksum: null,
  seedKey: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-10T00:00:00Z',
}

describe('AdminSafetyDirectoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    confirm.mockResolvedValue(true)
    api.list.mockResolvedValue([entry])
  })

  it('renders authoritative lifecycle and provenance detail', async () => {
    render(<AdminSafetyDirectoryManager />)
    expect(
      await screen.findByRole('heading', {
        name: 'Đường dây hỗ trợ quốc gia',
      }),
    ).toBeVisible()
    expect(screen.getAllByText('Đã xác minh')).toHaveLength(3)
    expect(screen.getByText('Nguồn chính thức')).toBeVisible()
    expect(screen.getByText('Công văn 01')).toBeVisible()
    expect(screen.getAllByText(/v3/)).toHaveLength(2)
  })

  it('shows a deterministic empty state without fake records', async () => {
    api.list.mockResolvedValue([])
    render(<AdminSafetyDirectoryManager />)
    expect(await screen.findByText('Không có bản ghi phù hợp.')).toBeVisible()
    expect(screen.getByText('Chọn một bản ghi để xem chi tiết.')).toBeVisible()
  })

  it('fails closed when the current admin is forbidden', async () => {
    api.list.mockRejectedValue(
      new ApiError({ message: 'Forbidden', code: 'FORBIDDEN', status: 403 }),
    )
    render(<AdminSafetyDirectoryManager />)
    expect(
      await screen.findByText('Bạn không có quyền quản trị thư mục an toàn.', {
        exact: false,
      }),
    ).toBeVisible()
    expect(api.transition).not.toHaveBeenCalled()
  })

  it('requires confirmation and refreshes authoritative data on stale mutation', async () => {
    const user = userEvent.setup()
    api.transition.mockRejectedValue(
      new ApiError({
        message: 'Conflict',
        code: 'INVALID_STATE_TRANSITION',
        status: 409,
      }),
    )
    api.list
      .mockResolvedValueOnce([entry])
      .mockResolvedValueOnce([
        { ...entry, recordVersion: 4, reviewState: 'INACTIVE', active: false },
      ])
    render(<AdminSafetyDirectoryManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Ngừng kích hoạt' }),
    )
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
    expect(
      screen.getByText('Bản ghi đã thay đổi.', { exact: false }),
    ).toBeVisible()
    expect((await screen.findAllByText(/v4/)).length).toBeGreaterThan(0)
  })

  it('reuses the create command key after an ambiguous failure', async () => {
    const user = userEvent.setup()
    api.list.mockResolvedValue([])
    api.create
      .mockRejectedValueOnce(
        new ApiError({ message: 'Timeout', code: 'REQUEST_TIMEOUT' }),
      )
      .mockResolvedValueOnce(entry)
    render(<AdminSafetyDirectoryManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Thêm bản ghi' }),
    )
    await user.type(screen.getByLabelText('Tên bản ghi'), 'Đường dây mới')
    await user.type(screen.getByLabelText('Số liên hệ'), '111')
    await user.type(screen.getByLabelText('Tên nguồn'), 'Nguồn chính thức')
    await user.type(
      screen.getByLabelText('Thời điểm truy xuất nguồn'),
      '2026-11-10T08:30',
    )
    await user.type(screen.getByLabelText('Tham chiếu nguồn'), 'Công văn 01')
    await user.click(screen.getByRole('button', { name: 'Lưu bản ghi' }))
    await screen.findByText('Timeout', { exact: false })
    await user.click(screen.getByRole('button', { name: 'Lưu bản ghi' }))
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2))
    expect(api.create.mock.calls[1][1]).toBe(api.create.mock.calls[0][1])
  })
})
