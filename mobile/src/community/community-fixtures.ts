import type {
  CommunityPost,
  CommunitySummary,
  CommunityTopic,
  VersionedProfile,
} from './community-contract'

export const fixturePostId = '11111111-1111-4111-8111-111111111111'
export const fixtureProfileId = '22222222-2222-4222-8222-222222222222'
export const fixtureDate = '2026-10-09T01:00:00Z'
export const fixturePost: CommunityPost = {
  postId: fixturePostId,
  author: {
    communityProfileId: fixtureProfileId,
    displayName: 'Bạn cùng cộng đồng',
    avatarPreset: 'LEAF',
    state: 'ACTIVE',
  },
  content: 'Hôm nay tôi đi dạo một chút.',
  topics: ['SMALL_MILESTONE'],
  media: [],
  mediaAvailability: 'NONE',
  counts: { comments: 0, reactions: 0 },
  viewerState: { reaction: null, bookmarked: false },
  publishedAt: fixtureDate,
  updatedAt: fixtureDate,
  resourceAttachment: null,
  sensitiveContentWarning: null,
}
export const fixtureSummary: CommunitySummary = (() => {
  const { content, ...fields } = fixturePost
  return { ...fields, contentPreview: content }
})()
export const fixtureTopics: CommunityTopic[] = [
  {
    code: 'SMALL_MILESTONE',
    label: 'Bước nhỏ',
    description: 'Những cột mốc nhỏ bạn muốn chia sẻ.',
  },
  {
    code: 'MY_STORY',
    label: 'Câu chuyện của tôi',
    description: 'Trải nghiệm của bạn.',
  },
]
export const fixtureProfile: VersionedProfile = {
  etag: '"0"',
  profile: {
    communityProfileId: fixtureProfileId,
    displayName: 'Bạn cùng cộng đồng',
    avatarPreset: 'LEAF',
    status: 'ACTIVE',
    version: 0,
    createdAt: fixtureDate,
    updatedAt: fixtureDate,
  },
}
