import { http, HttpResponse } from 'msw'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { mockServer } from '@/tests/mocks/server'

vi.mock('@/features/auth/components/PasswordChangeForm', () => ({
  default: () => <div data-testid="password-change-form" />,
}))

import ProfilePage from './page'

const profile = {
  accountId: '10000000-0000-4000-8000-000000000001',
  displayName: 'Nguyễn An',
  dateOfBirth: '2000-01-02',
  gender: 'other',
  locale: 'vi-VN',
  timezone: 'Asia/Ho_Chi_Minh',
  reminderEnabled: false,
  createdAt: '2026-09-02T00:00:00Z',
  updatedAt: '2026-09-02T00:00:00Z',
  version: 0,
}
const disclosure = {
  consentType: 'PRIVACY_POLICY',
  version: 'privacy-capstone-v2',
  locale: 'vi-VN',
  title: 'Thông báo xử lý dữ liệu',
  content: 'Nội dung authoritative từ Care.',
  capstoneOnly: true,
}

describe('Care profile page', () => {
  it('renders backend data and appends a privacy decision without fake specialist data', async () => {
    const decision = vi.fn()
    mockServer.use(
      http.get('http://localhost/api/care/profile', () =>
        HttpResponse.json(profile),
      ),
      http.get('http://localhost/api/care/privacy-disclosure', () =>
        HttpResponse.json(disclosure),
      ),
      http.get('http://localhost/api/care/consents', () =>
        HttpResponse.json({ decisions: [] }),
      ),
      http.post(
        'http://localhost/api/care/consent-decisions',
        async ({ request }) => {
          decision(await request.json())
          return HttpResponse.json(
            {
              decisionId: '10000000-0000-4000-8000-000000000002',
              consentType: 'PRIVACY_POLICY',
              policyVersion: 'privacy-capstone-v2',
              granted: true,
              decidedAt: '2026-09-02T00:01:00Z',
            },
            { status: 201 },
          )
        },
      ),
    )
    render(<ProfilePage />)
    await screen.findByDisplayValue('Nguyễn An')
    expect(screen.getByTestId('password-change-form')).toBeInTheDocument()
    expect(screen.getByText('Nội dung authoritative từ Care.')).toBeVisible()
    expect(screen.queryByText(/ThS\.|specialist/i)).not.toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Tôi đã đọc và xác nhận' }),
    )
    expect(decision).toHaveBeenCalledWith({
      consentType: 'PRIVACY_POLICY',
      policyVersion: 'privacy-capstone-v2',
      granted: true,
    })
    await screen.findByText(/đã ghi nhận xác nhận về quyền riêng tư/i)
  })

  it('shows first-time onboarding when profile and consent data are empty', async () => {
    mockServer.use(
      http.get('http://localhost/api/care/profile', () =>
        HttpResponse.json(
          {
            type: '/problems/profile-not-found',
            title: 'Care profile was not found',
            status: 404,
            code: 'PROFILE_NOT_FOUND',
            correlationId: '10000000-0000-4000-8000-000000000010',
          },
          {
            status: 404,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
      http.get('http://localhost/api/care/privacy-disclosure', () =>
        HttpResponse.json(disclosure),
      ),
      http.get('http://localhost/api/care/consents', () =>
        HttpResponse.json({ decisions: [] }),
      ),
    )

    render(<ProfilePage />)

    expect(await screen.findByText('Bạn chưa có hồ sơ')).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Tạo hồ sơ' })).toHaveLength(2)
    expect(screen.queryByText(/không thể tải đầy đủ/i)).not.toBeInTheDocument()
  })

  it('keeps the persisted header separate from an editable draft and can cancel changes', async () => {
    mockServer.use(
      http.get('http://localhost/api/care/profile', () =>
        HttpResponse.json(profile),
      ),
      http.get('http://localhost/api/care/privacy-disclosure', () =>
        HttpResponse.json(disclosure),
      ),
      http.get('http://localhost/api/care/consents', () =>
        HttpResponse.json({ decisions: [] }),
      ),
    )
    const user = userEvent.setup()
    render(<ProfilePage />)

    const name = await screen.findByLabelText('Tên hiển thị')
    await user.clear(name)
    await user.type(name, 'Tên nháp')

    expect(screen.getByRole('heading', { name: 'Nguyễn An' })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Tên nháp' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hủy thay đổi' }))
    expect(name).toHaveValue('Nguyễn An')
  })

  it('shows an adult-rule violation next to the birth-date field without submitting', async () => {
    const update = vi.fn()
    mockServer.use(
      http.get('http://localhost/api/care/profile', () =>
        HttpResponse.json(profile),
      ),
      http.get('http://localhost/api/care/privacy-disclosure', () =>
        HttpResponse.json(disclosure),
      ),
      http.get('http://localhost/api/care/consents', () =>
        HttpResponse.json({ decisions: [] }),
      ),
      http.put('http://localhost/api/care/profile', () => {
        update()
        return HttpResponse.json(profile)
      }),
    )
    const user = userEvent.setup()
    render(<ProfilePage />)
    const dateOfBirth = await screen.findByLabelText('Ngày sinh')
    const underageYear = new Date().getUTCFullYear() - 17

    await user.clear(dateOfBirth)
    await user.type(dateOfBirth, `${underageYear}-01-01`)
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(
      await screen.findByText('Bạn cần đủ 18 tuổi để tạo hồ sơ.'),
    ).toBeVisible()
    expect(dateOfBirth).toHaveAttribute('aria-invalid', 'true')
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps the draft when saving fails', async () => {
    mockServer.use(
      http.get('http://localhost/api/care/profile', () =>
        HttpResponse.json(profile),
      ),
      http.get('http://localhost/api/care/privacy-disclosure', () =>
        HttpResponse.json(disclosure),
      ),
      http.get('http://localhost/api/care/consents', () =>
        HttpResponse.json({ decisions: [] }),
      ),
      http.put('http://localhost/api/care/profile', () =>
        HttpResponse.json(
          {
            type: '/problems/care-unavailable',
            title: 'Care unavailable',
            status: 503,
            code: 'CARE_UNAVAILABLE',
            correlationId: '10000000-0000-4000-8000-000000000010',
          },
          {
            status: 503,
            headers: { 'Content-Type': 'application/problem+json' },
          },
        ),
      ),
    )
    const user = userEvent.setup()
    render(<ProfilePage />)
    const name = await screen.findByLabelText('Tên hiển thị')

    await user.clear(name)
    await user.type(name, 'Tên vẫn được giữ')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nội dung bạn vừa nhập vẫn được giữ lại',
    )
    expect(name).toHaveValue('Tên vẫn được giữ')
    expect(screen.getByRole('heading', { name: 'Nguyễn An' })).toBeVisible()
  })
})
