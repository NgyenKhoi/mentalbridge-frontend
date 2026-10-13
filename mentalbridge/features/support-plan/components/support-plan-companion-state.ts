export type SupportPlanCompanionState =
  | 'idle'
  | 'greeting'
  | 'thinking'
  | 'encouraging'
  | 'celebrating-light'
  | 'calm-empathetic'
  | 'waiting'

export type SupportPlanCompanionEvent =
  | 'CONTENT_READY'
  | 'SURFACE_ENTERED'
  | 'REQUEST_STARTED'
  | 'NEXT_STEP_AVAILABLE'
  | 'EXPLICIT_COMPLETION_ACKNOWLEDGED'
  | 'SENSITIVE_CONTEXT_ENTERED'
  | 'WAITING_FOR_USER'

export type SupportPlanCompanionSurface =
  'today' | 'plan' | 'progress' | 'adjust'

const eventTargets: Readonly<
  Record<SupportPlanCompanionEvent, SupportPlanCompanionState>
> = {
  CONTENT_READY: 'idle',
  SURFACE_ENTERED: 'greeting',
  REQUEST_STARTED: 'thinking',
  NEXT_STEP_AVAILABLE: 'encouraging',
  EXPLICIT_COMPLETION_ACKNOWLEDGED: 'celebrating-light',
  SENSITIVE_CONTEXT_ENTERED: 'calm-empathetic',
  WAITING_FOR_USER: 'waiting',
}

export const companionStateCopy: Readonly<
  Record<SupportPlanCompanionState, { label: string; description: string }>
> = {
  idle: {
    label: 'Nghỉ nhẹ',
    description: 'Mình ở đây khi bạn muốn xem bước tiếp theo.',
  },
  greeting: {
    label: 'Chào bạn',
    description: 'Bạn có thể bắt đầu từ điều phù hợp nhất lúc này.',
  },
  thinking: {
    label: 'Đang chuẩn bị',
    description: 'Mình đang sắp xếp phần hướng dẫn ngắn gọn cho bạn.',
  },
  encouraging: {
    label: 'Khích lệ nhẹ',
    description: 'Một bước nhỏ, do bạn chọn, cũng đã là đủ cho hôm nay.',
  },
  'celebrating-light': {
    label: 'Đã ghi nhận',
    description: 'Lựa chọn bạn vừa xác nhận đã được ghi nhận.',
  },
  'calm-empathetic': {
    label: 'Tĩnh lặng',
    description: 'Mình ở đây cùng bạn, không thúc giục hay phán xét.',
  },
  waiting: {
    label: 'Đang đồng hành',
    description: 'Mình sẽ chờ trong khi MentalBridge hoàn tất bước này.',
  },
}

export const companionSurfaceCopy: Readonly<
  Record<SupportPlanCompanionSurface, string>
> = {
  today: 'Bạn có thể chọn một bước phù hợp với nhịp hôm nay.',
  plan: 'Bạn có thể xem từng phần trước khi quyết định.',
  progress: 'Những ghi nhận này giúp bạn nhìn lại, không phải để chấm điểm.',
  adjust: 'Bạn có thể xem kỹ từng lựa chọn trước khi xác nhận thay đổi.',
}

/**
 * Maps one bounded UI event to one visual state. The previous state is accepted
 * so animation runtimes can use a reducer API, but no transition reads health,
 * plan authority, or private content.
 */
export function transitionSupportPlanCompanion(
  _current: SupportPlanCompanionState,
  event: SupportPlanCompanionEvent,
): SupportPlanCompanionState {
  return eventTargets[event]
}
