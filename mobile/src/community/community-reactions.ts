import type { Reaction } from './community-contract'

// The one place that maps a reaction kind to its emoji and spoken meaning.
export const reactionKinds: readonly {
  value: Reaction
  emoji: string
  label: string
}[] = [
  { value: 'SUPPORT', emoji: '❤️', label: 'Mình ở đây' },
  { value: 'RELATE', emoji: '🤗', label: 'Mình đồng cảm' },
  { value: 'THANK_YOU', emoji: '🥰', label: 'Cảm ơn bạn' },
]

export const reactionKind = (value: Reaction) =>
  reactionKinds.find((kind) => kind.value === value) ?? reactionKinds[0]!

/** Shown in the comment input bar; tapping one inserts it into the text. */
export const quickEmoji = [
  ...reactionKinds.map((kind) => kind.emoji),
  '👏',
  '🌱',
  '💪',
  '🥹',
]

/** Reaction total after the viewer moves from `previous` to `next`. */
export const nextReactionCount = (
  count: number,
  previous: Reaction | null,
  next: Reaction | null,
) => Math.max(0, count + (next ? 1 : 0) - (previous ? 1 : 0))
