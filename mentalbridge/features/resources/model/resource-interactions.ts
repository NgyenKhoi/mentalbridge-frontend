import type { PublicResourceDetail } from '../api/browser-resources'

export type ResourceAction = Readonly<{
  id: string
  label: string
  seconds?: number
}>

export type ResourceInteraction = Readonly<{
  mode: 'reader' | 'video' | 'breathing' | 'timed' | 'steps'
  heading: string
  actions: readonly ResourceAction[]
  durationSeconds?: number
}>

function config(resource: PublicResourceDetail): Record<string, unknown> {
  return resource.interactionConfig ?? {}
}

function configuredActions(resource: PublicResourceDetail): ResourceAction[] {
  const steps = config(resource).steps
  if (!Array.isArray(steps)) return []
  return steps.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const value = entry as Record<string, unknown>
    if (
      typeof value.id !== 'string' ||
      !/^[A-Za-z0-9:_-]{1,64}$/.test(value.id) ||
      typeof value.label !== 'string' ||
      value.label.trim().length === 0
    ) {
      return []
    }
    return [
      {
        id: value.id,
        label: value.label,
        ...(Number.isSafeInteger(value.seconds) && (value.seconds as number) > 0
          ? { seconds: value.seconds as number }
          : {}),
      },
    ]
  })
}

const headings: Partial<
  Record<PublicResourceDetail['interactionType'], string>
> = {
  GROUNDING_GUIDE: 'Neo sự chú ý vào hiện tại',
  PROGRESSIVE_RELAXATION: 'Thả lỏng lần lượt, không gồng mạnh',
  WALK_TIMER: 'Vận động theo nhịp vừa sức',
  STRETCH_SEQUENCE: 'Chuỗi vận động nhẹ',
  PROBLEM_SOLVING_WORKSHEET: 'Gỡ một vấn đề thành bước khả thi',
  BEHAVIORAL_ACTIVATION_PLANNER: 'Lên lịch một hoạt động nhỏ',
  SELF_COMPASSION_PROMPTS: 'Nói với mình bằng sự tử tế thực tế',
  UNHOOKING_PROMPTS: 'Nhận biết rồi chọn hành động có ích',
  PREPARE_FOR_SPECIALIST_CHECKLIST: 'Chuẩn bị điều muốn trao đổi',
  REFLECTION: 'Nhìn lại theo từng bước',
}

export function resourceInteraction(
  resource: PublicResourceDetail,
): ResourceInteraction {
  const interactionType =
    resource.interactionType ??
    (resource.category === 'VIDEO'
      ? 'VIDEO_TRANSCRIPT'
      : resource.category === 'BREATHING'
        ? 'BREATHING_PACER'
        : resource.category === 'JOURNALING'
          ? 'REFLECTION'
          : 'STRUCTURED_READER')
  if (interactionType === 'VIDEO_TRANSCRIPT') {
    return {
      mode: 'video',
      heading: 'Xem và suy ngẫm',
      actions: [
        { id: 'video-viewed', label: 'Theo dõi phần chính của video' },
        { id: 'video-reflected', label: 'Hoàn thành 2 câu kiểm tra' },
      ],
    }
  }
  if (interactionType === 'BREATHING_PACER') {
    const value = config(resource)
    const inhale = Number.isSafeInteger(value.inhaleSeconds)
      ? (value.inhaleSeconds as number)
      : 4
    const exhale = Number.isSafeInteger(value.exhaleSeconds)
      ? (value.exhaleSeconds as number)
      : 6
    const hold = Number.isSafeInteger(value.holdSeconds)
      ? (value.holdSeconds as number)
      : 0
    const cycles = Number.isSafeInteger(value.cycles)
      ? Math.max(1, value.cycles as number)
      : 1
    return {
      mode: 'breathing',
      heading: 'Một nhịp thở nhẹ, không cần hít thật sâu',
      actions: [
        { id: 'inhale', label: 'Hít vào nhẹ', seconds: inhale },
        ...(hold > 0 ? [{ id: 'hold', label: 'Giữ nhẹ', seconds: hold }] : []),
        { id: 'exhale', label: 'Thở ra tự nhiên', seconds: exhale },
      ],
      durationSeconds: (inhale + hold + exhale) * cycles,
    }
  }

  const actions = configuredActions(resource)
  if (actions.length > 0) {
    const configuredDuration = config(resource).durationSeconds
    const durationSeconds = Number.isSafeInteger(configuredDuration)
      ? (configuredDuration as number)
      : actions.reduce((total, action) => total + (action.seconds ?? 0), 0)
    return {
      mode:
        resource.completionMode === 'TIMED' && durationSeconds > 0
          ? 'timed'
          : 'steps',
      heading: headings[interactionType] ?? 'Thực hành theo từng bước',
      actions,
      ...(durationSeconds > 0 ? { durationSeconds } : {}),
    }
  }

  if (resource.category === 'JOURNALING') {
    return {
      mode: 'steps',
      heading: headings[interactionType] ?? 'Nhìn lại theo từng bước',
      actions: [
        { id: 'settle', label: 'Dừng lại và gọi tên cảm xúc hiện tại' },
        {
          id: 'write',
          label: 'Viết tự do trong vài phút, không cần chỉnh sửa',
        },
        {
          id: 'reflect',
          label: 'Chọn một điều dịu dàng bạn muốn dành cho mình',
        },
      ],
    }
  }

  return {
    mode: 'reader',
    heading: 'Giữ lại một điều hữu ích',
    actions: [
      { id: 'read', label: 'Đọc nội dung theo nhịp độ của bạn' },
      { id: 'takeaway', label: 'Chọn một ý nhỏ muốn mang theo hôm nay' },
    ],
  }
}
