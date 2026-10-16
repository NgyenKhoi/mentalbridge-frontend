import { http, HttpResponse } from 'msw'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import AssessmentsPage from './page'

describe('Assessment history page', () => {
  it('renders owned backend summaries and a link that reopens the exact result', async () => {
    const assessmentId = '10000000-0000-4000-8000-000000000003'
    mockServer.use(
      http.get('http://localhost/api/care/assessments/history', () =>
        HttpResponse.json({
          items: [
            {
              assessmentId,
              questionnaireDefinitionId: '10000000-0000-4000-8000-000000000001',
              instrument: 'PHQ9',
              questionnaireVersion: 'phq9-vi-vn-capstone-v1',
              privacyPolicyVersion: 'privacy-capstone-v2',
              submittedAt: '2026-09-02T00:00:00Z',
              result: {
                totalScore: 8,
                screeningLevel: 'MILD',
                scoringVersion: 'phq9-standard-bands-v1',
                safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
                safetyPolicyVersion: 'MB-SAFETY-PHQ9-001/1.0-capstone',
                disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
              },
            },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
      http.get('http://localhost/api/care/support-evaluations/history', () =>
        HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
      ),
      http.get('http://localhost/api/care/screening-episodes/history', () =>
        HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
      ),
      http.get('http://localhost/api/care/reassessment-self-reports', () =>
        HttpResponse.json(
          { code: 'REASSESSMENT_SELF_REPORT_NOT_FOUND' },
          { status: 404 },
        ),
      ),
      http.get('http://localhost/api/care/reassessment-summaries', () =>
        HttpResponse.json({
          policyVersion: 'reassessment-comparison-v1',
          state: 'INCOMPLETE',
          missingInstruments: ['GAD7'],
          phq9AssessmentId: assessmentId,
          gad7AssessmentId: null,
          previousPeriod: {
            startAt: '2026-08-27T00:00:00Z',
            endAt: '2026-09-10T00:00:00Z',
          },
          currentPeriod: {
            startAt: '2026-09-10T00:00:00Z',
            endAt: '2026-09-24T00:00:00Z',
          },
        }),
      ),
      http.get(
        `http://localhost/api/care/assessments/by-id/${assessmentId}/progress`,
        () =>
          HttpResponse.json({
            instrument: 'PHQ9',
            scoringVersion: 'phq9-standard-bands-v1',
            previous: {
              assessmentId: '10000000-0000-4000-8000-000000000002',
              questionnaireVersion: 'phq9-vi-vn-capstone-v1',
              submittedAt: '2026-08-30T00:00:00Z',
              totalScore: 2,
              screeningLevel: 'MINIMAL',
            },
            current: {
              assessmentId,
              questionnaireVersion: 'phq9-vi-vn-capstone-v1',
              submittedAt: '2026-09-02T00:00:00Z',
              totalScore: 8,
              screeningLevel: 'MILD',
            },
            rawDelta: 6,
            scoreDirection: 'INCREASED',
            bandTransition: { previous: 'MINIMAL', current: 'MILD' },
            elapsedDuration: 'PT72H',
          }),
      ),
    )
    render(<AssessmentsPage />)
    expect(
      screen.getByRole('heading', { name: 'Bài sàng lọc', level: 1 }),
    ).toBeVisible()
    expect(
      screen.getByRole('tab', { name: 'Lịch sử sàng lọc' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('heading', {
        name: 'Lịch sử theo từng lượt sàng lọc',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Bắt đầu PHQ-9 và GAD-7' }),
    ).toHaveAttribute('href', '/initial-check')
    expect(
      screen.queryByRole('region', { name: 'Chọn bài sàng lọc' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Kết quả sàng lọc gần nhất' }),
    ).not.toBeInTheDocument()
    const standaloneDisclosure = screen.getByRole('button', {
      name: 'Bài sàng lọc riêng lẻ và kết quả từng bài',
    })
    expect(standaloneDisclosure.closest('details')).not.toHaveAttribute('open')
    await userEvent.click(standaloneDisclosure)
    expect(
      screen.getByRole('link', { name: 'Làm riêng PHQ-9' }),
    ).toHaveAttribute('href', '/assessment/phq9')
    expect(
      screen.getByRole('link', { name: 'Làm riêng GAD-7' }),
    ).toHaveAttribute('href', '/assessment/gad7')
    expect(await screen.findByText('8 điểm')).toBeVisible()
    expect(screen.getByText('Nhẹ')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Xem lại' })).toHaveAttribute(
      'href',
      `/assessment/phq9?assessmentId=${assessmentId}`,
    )
    const compareButton = screen.getByRole('button', { name: 'So sánh' })
    await userEvent.click(compareButton)
    expect(await screen.findByText('Điểm đã tăng 6 điểm.')).toBeVisible()
    expect(screen.getByText('3 ngày')).toBeVisible()
    expect(
      screen.queryByText(/hồi phục|cải thiện|xấu đi/i),
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Đóng so sánh' }))
    expect(compareButton).toHaveFocus()
    expect(
      screen.queryByRole('heading', {
        name: 'Thay đổi giữa các lần sàng lọc',
      }),
    ).not.toBeInTheDocument()

    const historyTab = screen.getByRole('tab', { name: 'Lịch sử sàng lọc' })
    historyTab.focus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Đánh giá lại' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Đánh giá lại' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      screen.getByRole('heading', {
        name: 'Hiểu những thay đổi của bạn qua bốn góc nhìn',
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Bắt đầu lượt đánh giá lại' }),
    ).toHaveAttribute('href', '/initial-check?purpose=reassessment')
    await userEvent.keyboard('{Home}')
    expect(historyTab).toHaveFocus()
    expect(historyTab).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowRight}')
    expect(
      screen.getByRole('tab', { name: 'Gợi ý sau sàng lọc' }),
    ).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'panel-support')
  })

  it('does not misreport a history failure as no previous assessment', async () => {
    mockServer.use(
      http.get('http://localhost/api/care/assessments/history', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Service unavailable',
            status: 503,
            code: 'CARE_UNAVAILABLE',
          },
          { status: 503 },
        ),
      ),
      http.get('http://localhost/api/care/screening-episodes/history', () =>
        HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
      ),
      http.get('http://localhost/api/care/support-evaluations/history', () =>
        HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
      ),
      http.get('http://localhost/api/care/reassessment-self-reports', () =>
        HttpResponse.json(
          { code: 'REASSESSMENT_SELF_REPORT_NOT_FOUND' },
          { status: 404 },
        ),
      ),
      http.get('http://localhost/api/care/reassessment-summaries', () =>
        HttpResponse.json({
          policyVersion: 'reassessment-comparison-v1',
          state: 'INCOMPLETE',
          missingInstruments: ['PHQ9', 'GAD7'],
          phq9AssessmentId: null,
          gad7AssessmentId: null,
          previousPeriod: null,
          currentPeriod: null,
        }),
      ),
    )

    render(<AssessmentsPage />)

    await userEvent.click(
      screen.getByRole('button', {
        name: 'Bài sàng lọc riêng lẻ và kết quả từng bài',
      }),
    )
    expect(
      await screen.findByText('Không thể tải lịch sử từng bài'),
    ).toBeVisible()
    expect(screen.queryByText('Chưa thực hiện')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Không thể tải lịch sử từng bài',
    )
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeVisible()
  })
})
