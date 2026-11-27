import type { Href } from 'expo-router'

import type { HomeNextOccurrence, HomeNextStep } from './home-contract'

export type HomePresentation = Readonly<{
  eyebrow: string
  title: string
  description: string
  primaryLabel: string
  primaryHref: Href
  progress: string | null
}>

function planHref(): Href {
  return '/(user)/support-plan'
}

function occurrenceHref(
  occurrence: HomeNextOccurrence,
  localDate: string,
): Href {
  if (occurrence.actionType === 'EMOTION_CHECK_IN') {
    return {
      pathname: '/(user)/emotion',
      params: {
        occurrenceId: occurrence.occurrenceId,
        actionId: occurrence.actionId,
      },
    }
  }
  if (occurrence.actionType === 'JOURNAL') {
    return {
      pathname: '/(user)/journal',
      params: {
        source: 'journal',
        occurrenceId: occurrence.occurrenceId,
        actionId: occurrence.actionId,
        localDate,
      },
    }
  }
  if (occurrence.actionType === 'PROFESSIONAL_SUPPORT') {
    return {
      pathname: '/(user)/specialists',
      params: { planActionId: occurrence.actionId },
    }
  }
  if (occurrence.actionType === 'REASSESSMENT_SCREENING') {
    return '/(user)/assessment'
  }
  return {
    pathname: '/(user)/support-plan',
    params: {
      source: 'home',
      occurrenceId: occurrence.occurrenceId,
      actionId: occurrence.actionId,
      actionType: occurrence.actionType,
      localDate,
    },
  }
}

function planPresentation(home: HomeNextStep): HomePresentation | null {
  const plan = home.plan
  if (!plan) return null

  const progress =
    plan.today.total > 0
      ? `${plan.today.completed} hoạt động đã hoàn thành hôm nay`
      : null

  if (plan.focus === 'RESUME_PAUSED') {
    return {
      eyebrow: 'KẾ HOẠCH CỦA BẠN',
      title: 'Tiếp tục khi bạn thấy phù hợp',
      description:
        'Kế hoạch đang tạm dừng. Các hoạt động đã ghi nhận vẫn được giữ nguyên.',
      primaryLabel: 'Xem và tiếp tục kế hoạch',
      primaryHref: planHref(),
      progress,
    }
  }
  if (plan.focus === 'REVIEW_DUE') {
    return {
      eyebrow: 'ĐẾN LÚC XEM LẠI',
      title: 'Xem kế hoạch còn phù hợp với bạn không',
      description:
        'Bạn có thể xem lại tiến độ và chủ động chọn cách điều chỉnh tiếp theo.',
      primaryLabel: 'Xem lại kế hoạch',
      primaryHref: planHref(),
      progress,
    }
  }
  if (plan.focus === 'DO_TODAY' && plan.nextOccurrence) {
    const occurrence = plan.nextOccurrence
    const duration = occurrence.estimatedDurationMinutes
      ? ` Khoảng ${occurrence.estimatedDurationMinutes} phút.`
      : ''
    return {
      eyebrow:
        occurrence.displayState === 'OVERDUE' ? 'KHI BẠN SẴN SÀNG' : 'HÔM NAY',
      title: occurrence.title,
      description:
        occurrence.displayState === 'OVERDUE'
          ? `Hoạt động này vẫn đang chờ và bạn có thể tiếp tục khi phù hợp.${duration}`
          : `Đây là hoạt động tiếp theo trong kế hoạch của bạn.${duration}`,
      primaryLabel: 'Bắt đầu hoạt động',
      primaryHref: occurrenceHref(occurrence, plan.localDate),
      progress,
    }
  }
  if (plan.focus === 'TODAY_DONE') {
    return {
      eyebrow: 'HÔM NAY',
      title: 'Không còn hoạt động đang chờ hôm nay',
      description:
        'Bạn có thể xem lại những gì đã ghi nhận hoặc nghỉ ngơi mà không cần làm thêm.',
      primaryLabel: 'Xem tiến độ hôm nay',
      primaryHref: planHref(),
      progress,
    }
  }
  return {
    eyebrow: 'HÔM NAY',
    title: 'Hôm nay chưa có hoạt động được lên lịch',
    description:
      'Kế hoạch của bạn vẫn được giữ nguyên. Bạn có thể xem kế hoạch hoặc chọn một tài nguyên hữu ích.',
    primaryLabel: 'Xem kế hoạch',
    primaryHref: planHref(),
    progress,
  }
}

export function homePresentation(home: HomeNextStep): HomePresentation {
  const { journey } = home

  if (journey.stage === 'ASSESSMENT_REQUIRED') {
    return {
      eyebrow: 'BƯỚC ĐẦU TIÊN',
      title: journey.assessmentInProgress
        ? 'Tiếp tục bài sàng lọc của bạn'
        : 'Bắt đầu bằng một bài sàng lọc ngắn',
      description:
        'Câu trả lời của bạn giúp MentalBridge chuẩn bị gợi ý hỗ trợ phù hợp. Đây không phải là chẩn đoán.',
      primaryLabel: journey.assessmentInProgress
        ? 'Tiếp tục sàng lọc'
        : 'Bắt đầu sàng lọc',
      primaryHref: '/(user)/assessment',
      progress: null,
    }
  }

  if (journey.nextAction === 'REVIEW_SAFETY_SUPPORT') {
    return {
      eyebrow: 'ƯU TIÊN HỖ TRỢ',
      title: 'Xem hướng dẫn hỗ trợ đã được chuẩn bị cho bạn',
      description:
        'Mở kết quả đã lưu để xem hướng dẫn an toàn và các lựa chọn hỗ trợ phù hợp.',
      primaryLabel: 'Xem hướng dẫn hỗ trợ',
      primaryHref: '/(user)/assessment',
      progress: null,
    }
  }

  if (journey.nextAction === 'FIND_SPECIALIST') {
    return {
      eyebrow: 'BƯỚC TIẾP THEO',
      title: 'Tìm hỗ trợ chuyên môn phù hợp',
      description:
        'Xem danh sách chuyên gia và chủ động chọn người phù hợp với nhu cầu của bạn.',
      primaryLabel: 'Tìm chuyên gia',
      primaryHref: '/(user)/specialists',
      progress: null,
    }
  }

  const currentPlan = planPresentation(home)
  if (currentPlan) return currentPlan

  if (journey.stage === 'GUIDE_REQUIRED') {
    return {
      eyebrow: 'KẾT QUẢ ĐÃ SẴN SÀNG',
      title: 'Mở kết quả để chuẩn bị gợi ý hỗ trợ',
      description:
        'Kết quả sàng lọc đã được lưu. MentalBridge sẽ mở đúng kết quả này để hoàn tất gợi ý hỗ trợ.',
      primaryLabel: 'Xem kết quả sàng lọc',
      primaryHref: '/(user)/assessment',
      progress: null,
    }
  }

  if (journey.nextAction === 'REVIEW_PLAN_DRAFT') {
    return {
      eyebrow: 'KẾ HOẠCH ĐỀ XUẤT',
      title: 'Xem lại kế hoạch trước khi bắt đầu',
      description:
        'Bạn quyết định hoạt động nào phù hợp trước khi kế hoạch được kích hoạt.',
      primaryLabel: 'Xem kế hoạch đề xuất',
      primaryHref: '/(user)/support-plan',
      progress: null,
    }
  }

  if (journey.nextAction === 'START_PLAN_PROPOSAL') {
    return {
      eyebrow: 'GỢI Ý ĐÃ SẴN SÀNG',
      title: 'Chuẩn bị kế hoạch hỗ trợ để bạn xem lại',
      description: 'Kế hoạch chỉ bắt đầu sau khi bạn xem và chủ động đồng ý.',
      primaryLabel: 'Xem lựa chọn kế hoạch',
      primaryHref: '/(user)/support-plan',
      progress: null,
    }
  }

  return {
    eyebrow: home.lastCompletedPlan ? 'TIẾP TỤC CHĂM SÓC' : 'GỢI Ý CHO BẠN',
    title: home.lastCompletedPlan
      ? 'Kế hoạch gần nhất đã kết thúc'
      : 'Khám phá tài nguyên từ gợi ý đã lưu',
    description:
      journey.entitlementStatus === 'UNAVAILABLE'
        ? 'Chưa xác nhận được lựa chọn theo gói. Bạn vẫn có thể xem gợi ý và tài nguyên miễn phí.'
        : home.lastCompletedPlan
          ? 'Bạn vẫn có thể xem lại gợi ý hỗ trợ và chọn tài nguyên hữu ích khi cần.'
          : 'Các tài nguyên được duyệt vẫn sẵn sàng ngay cả khi bạn chưa có kế hoạch.',
    primaryLabel: 'Khám phá tài nguyên',
    primaryHref: '/(user)/resources',
    progress: null,
  }
}
