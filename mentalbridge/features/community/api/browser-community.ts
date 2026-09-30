import { browserApiClient } from '@/lib/api/browser-client'
import { parseOwnerVersion } from '@/lib/community/community-validation'
import type {
  CommunityAvatarPreset,
  CommunityFeedPage,
  CommunityProfile,
  CommunityPostDetail,
  CommunityPostWrite,
  CommunityTopic,
  CommunityTopicCode,
  PutCommunityProfileRequest,
} from '@/lib/community/community-validation'

export type {
  CommunityAvatarPreset,
  CommunityFeedPage,
  CommunityProfile,
  CommunityPostDetail,
  CommunityPostWrite,
  CommunityTopic,
  CommunityTopicCode,
  PutCommunityProfileRequest,
}

export type VersionedCommunityPost = Readonly<{
  post: CommunityPostDetail
  version: number | null
}>

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
  return {
    post: response.data,
    version: parseOwnerVersion(response.headers.etag),
  }
}

export async function getCommunityTopics() {
  const response =
    await browserApiClient.get<CommunityTopic[]>('/community/topics')
  return response.data
}

export async function createCommunityPost(
  input: CommunityPostWrite,
  idempotencyKey: string,
): Promise<VersionedCommunityPost> {
  const response = await browserApiClient.post<CommunityPostDetail>(
    '/community/posts',
    input,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return {
    post: response.data,
    version: parseOwnerVersion(response.headers.etag),
  }
}

export async function updateCommunityPost(
  postId: string,
  input: CommunityPostWrite,
  version: number,
): Promise<VersionedCommunityPost> {
  const response = await browserApiClient.patch<CommunityPostDetail>(
    `/community/posts/${encodeURIComponent(postId)}`,
    input,
    { headers: { 'If-Match': `"${version}"` } },
  )
  return {
    post: response.data,
    version: parseOwnerVersion(response.headers.etag),
  }
}

export async function deleteCommunityPost(postId: string, version: number) {
  await browserApiClient.delete(
    `/community/posts/${encodeURIComponent(postId)}`,
    { headers: { 'If-Match': `"${version}"` } },
  )
}

export async function getCommunityProfile() {
  const response =
    await browserApiClient.get<CommunityProfile>('/community/profile')
  return { data: response.data, etag: response.headers.etag ?? null }
}

export async function putCommunityProfile(
  input: PutCommunityProfileRequest,
  etag: string | null,
) {
  const response = await browserApiClient.put<CommunityProfile>(
    '/community/profile',
    input,
    { headers: etag ? { 'If-Match': etag } : undefined },
  )
  return { data: response.data, etag: response.headers.etag ?? null }
}
