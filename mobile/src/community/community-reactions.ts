import type { Reaction } from './community-contract'

// The one place that maps a reaction kind to its emoji and spoken meaning.
export const reactionKinds: readonly {
  value: Reaction
  emoji: string
  label: string
}[] = [
  { value: 'LIKE', emoji: '👍', label: 'Thích' },
  { value: 'SUPPORT', emoji: '❤️', label: 'Thương' },
  { value: 'THANK_YOU', emoji: '🥰', label: 'Cảm ơn' },
  { value: 'RELATE', emoji: '🤗', label: 'Ôm' },
  { value: 'EMPATHY', emoji: '😢', label: 'Đồng cảm' },
  { value: 'CHEER', emoji: '💪', label: 'Cố lên' },
  { value: 'GROWTH', emoji: '🌱', label: 'Đang lớn lên' },
]

/** Undefined for a kind this build does not know; callers render the neutral state. */
export const reactionKind = (value: Reaction) =>
  reactionKinds.find((kind) => kind.value === value)

/** Shown in the comment input bar; tapping one inserts it into the text. */
export const quickEmoji = reactionKinds.map((kind) => kind.emoji)

/** Reaction total after the viewer moves from `previous` to `next`. */
export const nextReactionCount = (
  count: number,
  previous: Reaction | null,
  next: Reaction | null,
) => Math.max(0, count + (next ? 1 : 0) - (previous ? 1 : 0))
