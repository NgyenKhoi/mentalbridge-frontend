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
const cancelConfirm = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/admin-safety-directory', () => ({
  adminSafetyDirectoryApi: api,
}))
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => ({
    confirm,
    cancelConfirm,
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

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Tên bản ghi'), 'Đường dây mới')
  await user.type(screen.getByLabelText('Số liên hệ'), '111')
  await user.type(screen.getByLabelText('Tên nguồn'), 'Nguồn chính thức')
  await user.type(
    screen.getByLabelText('Thời điểm truy xuất nguồn'),
    '2026-11-10T08:30',
  )
  await user.type(screen.getByLabelText('Tham chiếu nguồn'), 'Công văn 01')
}

describe('AdminSafetyDirectoryManager', () => {
  beforeEach(() => {
    vi.resetAllMocks()
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
    expect(screen.queryByRole('button', { name: 'Thêm bản ghi' })).toBeNull()
  })

  it('clears retained privileged data when authorization is lost on refresh', async () => {
    const user = userEvent.setup()
    api.list
      .mockResolvedValueOnce([entry])
      .mockRejectedValueOnce(
        new ApiError({ message: 'Forbidden', code: 'FORBIDDEN', status: 403 }),
      )
    render(<AdminSafetyDirectoryManager />)
    expect(
      await screen.findByRole('heading', { name: entry.name }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Làm mới' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn không có quyền quản trị thư mục an toàn.',
    )
    expect(screen.queryByRole('heading', { name: entry.name })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Duyệt và kích hoạt' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ngừng kích hoạt' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Thêm bản ghi' })).toBeNull()
    expect(cancelConfirm).toHaveBeenCalled()
  })

  it('clears details and pending confirmation state after mutation denial', async () => {
    const user = userEvent.setup()
    api.transition.mockRejectedValue(
      new ApiError({ message: 'Forbidden', code: 'FORBIDDEN', status: 403 }),
    )
    render(<AdminSafetyDirectoryManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Ngừng kích hoạt' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn không có quyền quản trị thư mục an toàn.',
    )
    expect(screen.queryByRole('heading', { name: entry.name })).toBeNull()
    expect(cancelConfirm).toHaveBeenCalled()
  })

  it('round-trips every coverage area and preserves the exact source instant on a no-op edit', async () => {
    const offset = vi
      .spyOn(Date.prototype, 'getTimezoneOffset')
      .mockReturnValue(-420)
    const user = userEvent.setup()
    const multiCoverage = {
      ...entry,
      sourceRetrievedAt: '2026-11-10T12:00:00Z',
      coverage: [
        {
          level: 'PROVINCE' as const,
          provinceCode: '79',
          provinceName: 'Thành phố Hồ Chí Minh',
          districtCode: null,
          districtName: null,
        },
        {
          level: 'DISTRICT' as const,
          provinceCode: '01',
          provinceName: 'Hà Nội',
          districtCode: '001',
          districtName: 'Ba Đình',
        },
      ],
    }
    api.list.mockResolvedValue([multiCoverage])
    api.update.mockResolvedValue(multiCoverage)
    render(<AdminSafetyDirectoryManager />)
    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa' }))

    expect(screen.getByLabelText('Mức phạm vi 1')).toHaveValue('PROVINCE')
    expect(screen.getByLabelText('Mức phạm vi 2')).toHaveValue('DISTRICT')
    expect(screen.getByLabelText('Thời điểm truy xuất nguồn')).toHaveValue(
      '2026-11-10T19:00',
    )
    await user.click(screen.getByRole('button', { name: 'Lưu bản ghi' }))

    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(1))
    expect(api.update.mock.calls[0][1]).toMatchObject({
      coverage: multiCoverage.coverage,
      sourceRetrievedAt: '2026-11-10T12:00:00Z',
    })
    offset.mockRestore()
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
    await fillCreateForm(user)
    await user.click(screen.getByRole('button', { name: 'Lưu bản ghi' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kết quả tạo chưa xác định.',
    )
    await user.click(screen.getByRole('button', { name: 'Lưu bản ghi' }))
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2))
    expect(api.create.mock.calls[1][1]).toBe(api.create.mock.calls[0][1])
  })

  it('uses a new create command key after an ambiguous draft is discarded', async () => {
    const user = userEvent.setup()
    api.list.mockResolvedValue([])
    api.create.mockRejectedValue(
      new ApiError({ message: 'Timeout', code: 'REQUEST_TIMEOUT' }),
    )
    render(<AdminSafetyDirectoryManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Thêm bản ghi' }),
    )
    await fillCreateForm(user)
    await user.click(screen.getByRole('button', { name: 'Lưu bản ghi' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Kết quả tạo chưa xác định.',
    )
    await user.click(screen.getByRole('button', { name: 'Hủy' }))
    await user.click(screen.getByRole('button', { name: 'Thêm bản ghi' }))
    await fillCreateForm(user)
    await user.click(screen.getByRole('button', { name: 'Lưu bản ghi' }))

    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(2))
    expect(api.create.mock.calls[1][1]).not.toBe(api.create.mock.calls[0][1])
  })
})
