import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import AdminAccountManager from './AdminAccountManager'

const userAccount = {
  accountId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
  email: 'member@example.com',
  status: 'ACTIVE' as const,
  roles: ['USER' as const],
  emailVerified: true,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  version: 2,
}

const api = vi.hoisted(() => ({
  search: vi.fn(),
  detail: vi.fn(),
  changeState: vi.fn(),
}))
const feedback = vi.hoisted(() => ({
  confirm: vi.fn(),
  showActionToast: vi.fn(),
}))
vi.mock('../api/browser-admin-accounts', () => ({
  browserAdminAccounts: api,
}))
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => feedback,
}))
const consultation = vi.hoisted(() => ({ detail: vi.fn() }))
vi.mock('@/features/specialist-profile/api/browser-client', () => ({
  browserConsultation: consultation,
}))

describe('AdminAccountManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.search.mockResolvedValue({ items: [userAccount], nextCursor: null })
    api.detail.mockResolvedValue({ data: userAccount, etag: '"2"' })
    api.changeState.mockResolvedValue({
      data: { ...userAccount, status: 'DISABLED', version: 3 },
      etag: '"3"',
    })
    feedback.confirm.mockResolvedValue(true)
  })

  it('names specialists, shows the real email with its verification and hides internals', async () => {
    const specialist = {
      ...userAccount,
      accountId: '8a43e8e2-5dc5-495d-ae95-fbb7346473e8',
      email: 'doctor@example.com',
      roles: ['SPECIALIST' as const],
      emailVerified: false,
    }
    api.search.mockResolvedValue({
      items: [userAccount, specialist],
      nextCursor: null,
    })
    api.detail.mockResolvedValue({ data: specialist, etag: '"2"' })
    consultation.detail.mockResolvedValue({
      data: { displayName: 'ThS. Thảo Nguyên' },
      etag: '"1"',
    })
    const user = userEvent.setup()
    render(<AdminAccountManager />)

    const card = await screen.findByRole('button', { name: /ThS. Thảo Nguyên/ })
    expect(card).toHaveTextContent('doctor@example.com')
    expect(consultation.detail).toHaveBeenCalledTimes(1)
    expect(consultation.detail).toHaveBeenCalledWith(specialist.accountId)
    expect(
      screen.queryByRole('option', { name: 'Quản trị viên' }),
    ).not.toBeInTheDocument()

    await user.click(card)
    expect(
      await screen.findByRole('heading', { name: 'ThS. Thảo Nguyên' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Chưa xác minh' })).toBeVisible()
    expect(screen.queryByText('Phiên bản')).not.toBeInTheDocument()
    expect(screen.queryByText('#8a43e8e2')).not.toBeInTheDocument()
  })

  it('searches by status, role and exact email', async () => {
    const user = userEvent.setup()
    render(<AdminAccountManager />)
    await screen.findByText('member@example.com')
    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'ACTIVE')
    await user.selectOptions(screen.getByLabelText('Vai trò'), 'USER')
    await user.type(
      screen.getByLabelText('Email chính xác'),
      'exact@example.com',
    )
    await user.click(screen.getByRole('button', { name: 'Tìm tài khoản' }))

    await waitFor(() =>
      expect(api.search).toHaveBeenLastCalledWith({
        status: 'ACTIVE',
        role: 'USER',
        email: 'exact@example.com',
        limit: 20,
      }),
    )
  })

  it('loads detail and suspends with a closed reason', async () => {
    const user = userEvent.setup()
    render(<AdminAccountManager />)
    await user.click(
      await screen.findByRole('button', { name: /member@example.com/ }),
    )
    await user.selectOptions(
      screen.getByLabelText('Lý do tạm ngưng'),
      'ACCOUNT_REVIEW_REQUIRED',
    )
    await user.click(
      screen.getByRole('button', { name: 'Tạm ngưng tài khoản' }),
    )

    await waitFor(() =>
      expect(api.changeState).toHaveBeenCalledWith(
        userAccount.accountId,
        { status: 'DISABLED', reasonCode: 'ACCOUNT_REVIEW_REQUIRED' },
        '"2"',
      ),
    )
    expect(
      await screen.findByRole('button', { name: 'Khôi phục tài khoản' }),
    ).toBeInTheDocument()
  })

  it('restores an already disabled account', async () => {
    const disabled = { ...userAccount, status: 'DISABLED' as const, version: 3 }
    api.search.mockResolvedValue({ items: [disabled], nextCursor: null })
    api.detail.mockResolvedValue({ data: disabled, etag: '"3"' })
    api.changeState.mockResolvedValue({
      data: { ...disabled, status: 'ACTIVE', version: 4 },
      etag: '"4"',
    })
    const user = userEvent.setup()
    render(<AdminAccountManager />)
    await user.click(
      await screen.findByRole('button', { name: /member@example.com/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Khôi phục tài khoản' }),
    )
    await waitFor(() =>
      expect(api.changeState).toHaveBeenCalledWith(
        disabled.accountId,
        { status: 'ACTIVE', reasonCode: 'REVIEW_COMPLETED' },
        '"3"',
      ),
    )
  })

  it('protects the dedicated admin from lifecycle actions', async () => {
    const admin = { ...userAccount, roles: ['ADMIN' as const] }
    api.search.mockResolvedValue({ items: [admin], nextCursor: null })
    api.detail.mockResolvedValue({ data: admin, etag: '"2"' })
    const user = userEvent.setup()
    render(<AdminAccountManager />)
    await user.click(
      await screen.findByRole('button', { name: /member@example.com/ }),
    )
    expect(
      await screen.findByText(/ADMIN chuyên dụng được bảo vệ/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Tạm ngưng tài khoản' }),
    ).not.toBeInTheDocument()
  })

  it('offers a refresh after a stale version conflict', async () => {
    api.changeState.mockRejectedValue(
      new ApiError({ message: 'stale', code: 'VERSION_CONFLICT', status: 412 }),
    )
    const user = userEvent.setup()
    render(<AdminAccountManager />)
    await user.click(
      await screen.findByRole('button', { name: /member@example.com/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Tạm ngưng tài khoản' }),
    )
    expect(
      await screen.findByRole('button', { name: 'Tải trạng thái mới nhất' }),
    ).toBeInTheDocument()
  })

  it('uses the opaque cursor to load the next page', async () => {
    api.search
      .mockResolvedValueOnce({ items: [userAccount], nextCursor: 'next-page' })
      .mockResolvedValueOnce({ items: [], nextCursor: null })
    const user = userEvent.setup()
    render(<AdminAccountManager />)
    await screen.findByText('member@example.com')
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))

    await waitFor(() =>
      expect(api.search).toHaveBeenLastCalledWith({
        cursor: 'next-page',
        limit: 20,
      }),
    )
  })

  it('shows the permission error returned for a non-admin session', async () => {
    api.search.mockRejectedValue(
      new ApiError({ message: 'forbidden', code: 'FORBIDDEN', status: 403 }),
    )
    render(<AdminAccountManager />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bạn không có quyền quản trị tài khoản.',
    )
  })

  it('confirms the specialist-state impact without exposing internals', async () => {
    const specialist = {
      ...userAccount,
      roles: ['SPECIALIST' as const],
    }
    api.search.mockResolvedValue({ items: [specialist], nextCursor: null })
    api.detail.mockResolvedValue({ data: specialist, etag: '"2"' })
    const user = userEvent.setup()
    render(<AdminAccountManager />)
    await user.click(
      await screen.findByRole('button', { name: /member@example.com/ }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Tạm ngưng tài khoản' }),
    )

    expect(feedback.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('hệ thống tư vấn'),
      }),
    )
    expect(feedback.confirm).not.toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringMatching(/Identity|lifecycle|bất đồng bộ/),
      }),
    )
  })

  it('excludes DELETED accounts from the status filter options', async () => {
    render(<AdminAccountManager />)
    await screen.findByText('member@example.com')
    expect(
      screen.queryByRole('option', { name: 'Đã xóa' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'Đã tạm ngưng' }),
    ).toBeInTheDocument()
  })
})
