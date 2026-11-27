import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BrowserConsultationError } from '@/features/specialist-profile/api/browser-client'
import SpecialistWorkspaceIdentity from './SpecialistWorkspaceIdentity'

const api = vi.hoisted(() => ({ own: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/features/specialist-profile/api/browser-client', () => ({
  browserConsultation: api,
  BrowserConsultationError: class BrowserConsultationError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message)
    }
  },
}))

const profile = {
  accountId: 'f5297ec9-bbc9-4d51-8212-62778245335c',
  displayName: 'Nguyễn An',
  bio: 'Hỗ trợ phi lâm sàng',
  supportAreas: ['DEPRESSIVE_SYMPTOMS'] as const,
  languages: ['vi'],
  yearsOfExperience: 4,
  timezone: 'Asia/Ho_Chi_Minh',
  approvalStatus: 'APPROVED' as const,
  submittedAt: '2026-09-14T03:10:00Z',
  reviewedAt: '2026-09-15T03:10:00Z',
  reviewedBy: 'admin-id',
  decisionReasonCode: null,
  createdAt: '2026-09-14T03:00:00Z',
  updatedAt: '2026-09-15T03:10:00Z',
  version: 2,
}

describe('SpecialistWorkspaceIdentity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the authenticated specialist profile instead of a fixed identity', async () => {
    api.own.mockResolvedValue({ data: profile, etag: '"2"' })

    render(<SpecialistWorkspaceIdentity />)

    expect(screen.getByText('Đang tải hồ sơ…')).toBeInTheDocument()
    expect(await screen.findByText('Nguyễn An')).toBeInTheDocument()
    expect(screen.getByText('Chuyên gia đã được duyệt')).toBeInTheDocument()
    expect(screen.queryByText('Người dùng')).not.toBeInTheDocument()
    expect(screen.queryByText('Tài khoản cá nhân')).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Mở menu tài khoản chuyên gia' }),
    )
    const menu = screen.getByRole('menu', { name: 'Tài khoản chuyên gia' })
    expect(
      within(menu).getByRole('menuitem', { name: 'Hồ sơ chuyên gia' }),
    ).toHaveAttribute('href', '/specialist/profile')
    expect(
      within(menu).getByRole('menuitem', { name: 'Đăng xuất' }),
    ).toBeInTheDocument()
    expect(
      within(menu).getByRole('menuitem', { name: 'Đăng xuất mọi thiết bị' }),
    ).toBeInTheDocument()
  })

  it('uses a truthful missing state when no specialist profile exists', async () => {
    api.own.mockRejectedValue(
      new BrowserConsultationError(404, 'PROFILE_NOT_FOUND', 'Not found'),
    )

    render(<SpecialistWorkspaceIdentity />)

    await waitFor(() =>
      expect(screen.getByText('Hồ sơ chưa hoàn tất')).toBeInTheDocument(),
    )
    expect(screen.getByText('Chuyên gia')).toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Thu Hà')).not.toBeInTheDocument()
  })

  it('does not claim a healthy profile when the owner is unavailable', async () => {
    api.own.mockRejectedValue(new Error('network unavailable'))

    render(<SpecialistWorkspaceIdentity />)

    await waitFor(() =>
      expect(screen.getByText('Chưa tải được hồ sơ')).toBeInTheDocument(),
    )
    expect(
      screen.queryByText('Chuyên gia đã được duyệt'),
    ).not.toBeInTheDocument()
  })
})
