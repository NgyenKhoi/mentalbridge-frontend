import type { SupportiveReaction } from '@/lib/community/community-validation'

// Same kinds, order, emoji and labels as the mobile tray (mobile/src/community/community-reactions.ts).
export const REACTIONS: ReadonlyArray<{
  value: SupportiveReaction
  emoji: string
  label: string
}> = [
  { value: 'LIKE', emoji: '👍', label: 'Thích' },
  { value: 'SUPPORT', emoji: '❤️', label: 'Thương' },
  { value: 'THANK_YOU', emoji: '🥰', label: 'Cảm ơn' },
  { value: 'RELATE', emoji: '🤗', label: 'Ôm' },
  { value: 'EMPATHY', emoji: '😢', label: 'Đồng cảm' },
  { value: 'CHEER', emoji: '💪', label: 'Cố lên' },
  { value: 'GROWTH', emoji: '🌱', label: 'Đang lớn lên' },
]
