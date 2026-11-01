import type { HomeNextStep } from '@/features/assessment/api/care-contract'

type HomeLink = Readonly<{ label: string; href: string }>

export type HomeNextStepView = Readonly<{
  state: string
  title: string
  description: string
  primary: HomeLink
  contextual: ReadonlyArray<HomeLink | Readonly<{ label: string; retry: true }>>
  safety?: boolean
  done?: boolean
  entitlementUnavailable?: boolean
  occurrence?: NonNullable<NonNullable<HomeNextStep['plan']>['nextOccurrence']>
  remaining?: number
}>

/** Presentation of Care's selected step; no plan or journey decisions are recomputed here. */
export function homeNextStepView(
  home: HomeNextStep,
  destination?: string,
  remaining?: number,
): HomeNextStepView {
  const { journey, plan } = home
  const guideHref = journey.supportGuideId
    ? `/support-guides/${journey.supportGuideId}`
    : '/support-guides'
  const guideLink = { label: 'Xem hướng dẫn', href: guideHref }

  // Safety stays ahead of the plan and completed-plan navigation.
  if (journey.nextAction === 'REVIEW_SAFETY_SUPPORT') {
    return {
      state: 'REVIEW_SAFETY_SUPPORT',
      title: 'Bạn có thể tìm hỗ trợ ngay',
      description:
        'Nếu đang gặp nguy hiểm, hãy gọi hỗ trợ khẩn cấp hoặc nhờ một người tin cậy ở bên bạn.',
      primary: { label: 'Xem nơi hỗ trợ', href: '/safety-directory' },
      contextual: plan
        ? [{ label: 'Mở kế hoạch', href: '/support-plan' }]
        : [guideLink],
      safety: true,
    }
  }

  if (
    plan &&
    journey.stage === 'GUIDE_READY' &&
    journey.nextAction !== 'FIND_SPECIALIST'
  ) {
    switch (plan.focus) {
      case 'DO_TODAY': {
        const title = plan.nextOccurrence?.title ?? 'Mở kế hoạch hôm nay'
        return {
          state: plan.focus,
          title,
          description:
            'Bạn có thể bắt đầu bằng việc này trong kế hoạch hôm nay.',
          primary: {
            label: 'Bắt đầu ngay',
            href: destination ?? '/support-plan',
          },
          contextual: [{ label: 'Mở kế hoạch hôm nay', href: '/support-plan' }],
          occurrence: plan.nextOccurrence ?? undefined,
          remaining,
        }
      }
      case 'TODAY_DONE':
        return {
          state: plan.focus,
          title: 'Bạn đã xong việc hôm nay',
          description: 'Bạn có thể xem lại kế hoạch khi muốn.',
          primary: { label: 'Xem kế hoạch', href: '/support-plan' },
          contextual: [],
          done: true,
        }
      case 'NOTHING_TODAY':
        return {
          state: plan.focus,
          title: 'Hôm nay không có việc nào trong kế hoạch',
          description: 'Bạn có thể mở kế hoạch để xem những việc sắp tới.',
          primary: { label: 'Xem kế hoạch', href: '/support-plan' },
          contextual: [],
        }
      case 'RESUME_PAUSED':
        return {
          state: plan.focus,
          title: 'Kế hoạch đang tạm dừng',
          description: 'Bạn có thể xem lại và tiếp tục khi sẵn sàng.',
          primary: {
            label: 'Xem và tiếp tục kế hoạch',
            href: '/support-plan',
          },
          contextual: [],
        }
      case 'REVIEW_DUE':
        return {
          state: plan.focus,
          title: 'Đến lúc nhìn lại 14 ngày qua',
          description: 'Nhìn lại những gì đã giúp bạn và chọn bước tiếp theo.',
          primary: {
            label: 'Xem lại kế hoạch',
            href: '/support-plan?review=open',
          },
          contextual: [{ label: 'Mở kế hoạch hôm nay', href: '/support-plan' }],
        }
    }
  }

  let view: HomeNextStepView
  if (journey.stage === 'ASSESSMENT_REQUIRED') {
    const label = journey.assessmentInProgress
      ? 'Tiếp tục kiểm tra ban đầu'
      : 'Bắt đầu kiểm tra ban đầu'
    view = {
      state: journey.assessmentInProgress
        ? 'ASSESSMENT_IN_PROGRESS'
        : 'ASSESSMENT_REQUIRED',
      title: 'Hiểu rõ hơn về 14 ngày gần đây',
      description:
        '16 câu hỏi ngắn, khoảng 5 phút. Bạn có thể dừng và quay lại sau.',
      primary: { label, href: '/initial-check' },
      contextual: [],
    }
  } else if (journey.stage === 'GUIDE_REQUIRED') {
    view = {
      state: 'GUIDE_REQUIRED',
      title: 'Hướng dẫn sau kiểm tra của bạn',
      description: 'Xem kết quả và những gợi ý hỗ trợ tiếp theo.',
      primary: {
        label: 'Xem kết quả và hướng dẫn của bạn',
        href: '/support-guides',
      },
      contextual: [],
    }
  } else {
    switch (journey.nextAction) {
      case 'FIND_SPECIALIST':
        view = {
          state: journey.nextAction,
          title: 'Tìm thêm sự hỗ trợ cho bạn',
          description: 'Hướng dẫn của bạn gợi ý trao đổi với chuyên gia.',
          primary: {
            label: 'Tìm chuyên gia phù hợp',
            href: destination ?? guideHref,
          },
          contextual: [guideLink],
        }
        break
      case 'START_PLAN_PROPOSAL':
        view = {
          state: journey.nextAction,
          title: 'Một kế hoạch cho 14 ngày tới',
          description: 'Xem đề xuất từ kết quả kiểm tra trước khi quyết định.',
          primary: {
            label: 'Xem đề xuất kế hoạch 14 ngày',
            href: destination ?? guideHref,
          },
          contextual: [guideLink],
        }
        break
      case 'REVIEW_PLAN_DRAFT':
        view = {
          state: journey.nextAction,
          title: 'Bản nháp kế hoạch đang chờ bạn',
          description: 'Xem lại những việc đã chọn trước khi bắt đầu.',
          primary: {
            label: 'Tiếp tục xem bản nháp kế hoạch',
            href: '/support-plan',
          },
          contextual: [],
        }
        break
      case 'OPEN_CURRENT_PLAN':
        view = {
          state: journey.nextAction,
          title: 'Tiếp tục kế hoạch của bạn',
          description: 'Mở kế hoạch để xem việc tiếp theo.',
          primary: { label: 'Xem kế hoạch', href: '/support-plan' },
          contextual: [],
        }
        break
      default: {
        const unavailable = journey.entitlementStatus === 'UNAVAILABLE'
        view = {
          state: 'EXPLORE_GUIDE_RESOURCES',
          title: 'Thử một tài nguyên trong hướng dẫn của bạn',
          description: 'Bài đọc và bài tập ngắn, chọn theo kết quả lần trước.',
          primary: {
            label: 'Mở tài nguyên được gợi ý',
            href: destination ?? guideHref,
          },
          contextual: unavailable
            ? [guideLink, { label: 'Thử lại', retry: true }]
            : [
                guideLink,
                { label: 'Xem trước kế hoạch hỗ trợ', href: '/support-plan' },
              ],
          entitlementUnavailable: unavailable,
        }
      }
    }
  }

  return home.lastCompletedPlan
    ? {
        ...view,
        contextual: [
          { label: 'Xem kế hoạch đã hoàn thành', href: '/support-plan' },
          { label: 'Làm lại kiểm tra', href: '/initial-check' },
        ],
      }
    : view
}
