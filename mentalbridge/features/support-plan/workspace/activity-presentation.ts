import { BookOpen, Heart, Moon, NotebookPen, Sparkles, Zap } from 'lucide-react'
import type { PlannedOccurrence } from './workspace-model'

/** Visual labels describe the saved activity, without adding capabilities. */
export function activityPresentation({ action }: PlannedOccurrence) {
  const title = action.presentation?.title ?? ''
  if (action.purposeCode.includes('SLEEP') || /ngủ|nghỉ ngơi/i.test(title))
    return { Icon: Moon, tone: 'sleep', label: 'Giấc ngủ & nghỉ ngơi' }
  if (action.purposeCode.includes('PSYCHOEDUCATION'))
    return { Icon: BookOpen, tone: 'learning', label: 'Kiến thức tâm lý' }
  if (action.actionType === 'JOURNAL')
    return { Icon: NotebookPen, tone: 'reflection', label: 'Nhật ký riêng tư' }
  if (action.actionType === 'EMOTION_CHECK_IN')
    return { Icon: Heart, tone: 'reflection', label: 'Ghi nhận cảm xúc' }
  if (
    action.purposeCode.includes('SUPPORT_ACTIVITY') ||
    /hoạt động nhỏ/i.test(title)
  )
    return { Icon: Zap, tone: 'practice', label: 'Hoạt động nhỏ' }
  if (action.actionType === 'RESOURCE')
    return { Icon: BookOpen, tone: 'learning', label: 'Tài nguyên hỗ trợ' }
  return { Icon: Sparkles, tone: 'practice', label: 'Chăm sóc bản thân' }
}
