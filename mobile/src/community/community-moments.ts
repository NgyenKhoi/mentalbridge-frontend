import type { CommunityMedia, CommunitySummary } from './community-contract'

// Same rule as the web discovery strip: a video post without a sensitive warning.
export const isMoment = (post: CommunitySummary) =>
  !post.sensitiveContentWarning &&
  post.media.some(({ type }) => type === 'VIDEO')

export const momentsOf = (posts: readonly CommunitySummary[]) =>
  posts.filter(isMoment)

export const momentVideo = (
  post: CommunitySummary,
): CommunityMedia | undefined => post.media.find(({ type }) => type === 'VIDEO')
