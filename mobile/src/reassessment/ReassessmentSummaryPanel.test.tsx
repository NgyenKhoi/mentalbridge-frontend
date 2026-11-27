import { fireEvent, render, screen } from '@testing-library/react-native'
import { ReassessmentSummaryPanel } from './ReassessmentSummaryPanel'
import { makeMobileReassessmentSummary } from './reassessment-test-fixtures'

it('uses the server supplied delta without turning score direction into a clinical verdict', async () => {
  await render(
    <ReassessmentSummaryPanel summary={makeMobileReassessmentSummary()} />,
  )
  expect(screen.getByText('PHQ-9')).toBeOnTheScreen()
  expect(screen.getByText('GAD-7')).toBeOnTheScreen()
  expect(screen.getByText('Giảm 2 điểm')).toBeOnTheScreen()
  expect(screen.getByText('Không đổi')).toBeOnTheScreen()
  expect(screen.queryByText(/DECREASED|UNCHANGED/)).toBeNull()
  expect(
    screen.getByText(/không gộp thành điểm số, chẩn đoán/),
  ).toBeOnTheScreen()
})

it('explains an unavailable Journal source and preserves the distinct direct and activity feedback sources', async () => {
  const base = makeMobileReassessmentSummary()
  const summary = {
    ...base,
    journalContext: {
      ...base.journalContext,
      state: 'UNAVAILABLE' as const,
      unavailableReason: 'ENTITLEMENT_UNAVAILABLE',
    },
    selfReportedExperience: {
      ...base.selfReportedExperience,
      source: {
        ...base.selfReportedExperience.source,
        helpfulContext: 'Đi bộ buổi sáng',
        difficultContext: 'Khó ngủ',
      },
    },
    activityReflection: { state: 'AVAILABLE' as const, sources: [{}, {}] },
  }
  await render(<ReassessmentSummaryPanel summary={summary} />)
  expect(
    screen.getByText(
      'Chưa kiểm tra được quyền lợi gói để đọc bối cảnh nhật ký.',
    ),
  ).toBeOnTheScreen()
  expect(screen.queryByText(/ENTITLEMENT_UNAVAILABLE/)).toBeNull()
  expect(screen.queryByText(/Đi bộ buổi sáng/)).toBeNull()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Xem chia sẻ & phản hồi' }),
  )
  expect(screen.getByText('Điều giúp ích: Đi bộ buổi sáng')).toBeOnTheScreen()
  expect(screen.getByText('Điều khó khăn: Khó ngủ')).toBeOnTheScreen()
  expect(screen.getByText(/2 phản hồi hoạt động/)).toBeOnTheScreen()
})

it('does not present missing compatible screening evidence as no change', async () => {
  const base = makeMobileReassessmentSummary()
  const summary = {
    ...base,
    screening: {
      ...base.screening,
      state: 'INSUFFICIENT_DATA' as const,
      trends: base.screening.trends.map((trend) => ({
        ...trend,
        state: 'INSUFFICIENT_DATA' as const,
        direction: 'INSUFFICIENT_DATA' as const,
        rawDelta: null,
        previous: null,
      })),
    },
  }
  await render(<ReassessmentSummaryPanel summary={summary} />)
  expect(
    screen.getAllByText('Chưa có kết quả tương thích để so sánh'),
  ).toHaveLength(2)
  expect(screen.queryByText('Không đổi')).toBeNull()
})
