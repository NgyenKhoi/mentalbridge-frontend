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
  version: 'privacy-capstone-v1',
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
              policyVersion: 'privacy-capstone-v1',
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
      policyVersion: 'privacy-capstone-v1',
      granted: true,
    })
    await screen.findByText(/đã ghi nhận xác nhận quyền riêng tư/i)
  })
})
