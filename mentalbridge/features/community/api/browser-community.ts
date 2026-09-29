import { browserApiClient } from '@/lib/api/browser-client'
import type {
  CommunityFeedPage,
  CommunityPostDetail,
  CommunityTopic,
  CommunityTopicCode,
} from '@/lib/community/community-validation'

export type {
  CommunityFeedPage,
  CommunityPostDetail,
  CommunityTopic,
  CommunityTopicCode,
}

export async function getCommunityFeed(
  topic?: CommunityTopicCode,
  cursor?: string,
) {
  const response = await browserApiClient.get<CommunityFeedPage>(
    '/community/feed',
    {
      params: {
        limit: 12,
        ...(topic ? { topic } : {}),
        ...(cursor ? { cursor } : {}),
      },
    },
  )
  return response.data
}

export async function getCommunityPost(postId: string) {
  const response = await browserApiClient.get<CommunityPostDetail>(
    `/community/posts/${encodeURIComponent(postId)}`,
  )
  return response.data
}

export async function getCommunityTopics() {
  const response =
    await browserApiClient.get<CommunityTopic[]>('/community/topics')
  return response.data
}
