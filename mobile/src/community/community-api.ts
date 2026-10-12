import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { ApiError } from '@/api/api-error'

import {
  commandKeySchema,
  commentPageSchema,
  commentSchema,
  commentWriteSchema,
  etagSchema,
  feedPageSchema,
  mediaRecordSchema,
  postDetailSchema,
  postWriteSchema,
  profileSchema,
  profileWriteSchema,
  reactionResultSchema,
  reactionSchema,
  reportWriteSchema,
  topicsSchema,
  uploadIntentSchema,
  uploadWriteSchema,
  type CommentPage,
  type CommunityComment,
  type CommunityPage,
  type CommunityTopic,
  type CommunityTopicCode,
  type MediaRecord,
  type PostWrite,
  type ProfileWrite,
  type Reaction,
  type ReportWrite,
  type UploadIntent,
  type UploadWrite,
  type VersionedPost,
  type VersionedProfile,
} from './community-contract'

export interface CommunityApi {
  feed(topics: CommunityTopicCode[], cursor?: string): Promise<CommunityPage>
  saved(cursor?: string): Promise<CommunityPage>
  topics(): Promise<CommunityTopic[]>
  detail(id: string): Promise<VersionedPost>
  create(body: PostWrite, key: string): Promise<VersionedPost>
  update(id: string, etag: string, body: PostWrite): Promise<VersionedPost>
  remove(id: string, etag: string): Promise<void>
  profile(): Promise<VersionedProfile | null>
  saveProfile(
    body: ProfileWrite,
    etag: string | null,
  ): Promise<VersionedProfile>
  comments(postId: string, cursor?: string): Promise<CommentPage>
  comment(
    postId: string,
    content: string,
    parentId: string | null,
    key: string,
  ): Promise<CommunityComment>
  react(postId: string, reaction: Reaction | null): Promise<void>
  bookmark(postId: string, saved: boolean): Promise<void>
  report(body: ReportWrite, key: string): Promise<void>
  block(profileId: string): Promise<void>
  hide(targetType: 'POST' | 'COMMENT', id: string): Promise<void>
  uploadIntent(body: UploadWrite, key: string): Promise<UploadIntent>
  finalize(mediaId: string): Promise<MediaRecord>
  removeMedia(mediaId: string, version: number): Promise<void>
}

const root = '/api/v1/community'
const pathId = (value: string) => encodeURIComponent(z.uuid().parse(value))
function identity(actual: string, expected: string) {
  if (actual !== expected)
    throw new ApiError({
      code: 'COMMUNITY_CONTRACT_MISMATCH',
      message: 'Community identity mismatch.',
      status: 502,
    })
}
function versionedPost(
  data: unknown,
  header: unknown,
  expected?: string,
  owner = false,
): VersionedPost {
  const post = postDetailSchema.parse(data)
  if (expected) identity(post.postId, expected)
  const etag = header == null ? null : etagSchema.parse(header)
  if (owner && etag === null)
    throw new ApiError({
      code: 'COMMUNITY_CONTRACT_MISMATCH',
      message: 'Missing owner version.',
      status: 502,
    })
  return { post, etag }
}
function versionedProfile(data: unknown, header: unknown): VersionedProfile {
  const profile = profileSchema.parse(data)
  const etag = etagSchema.parse(header)
  identity(etag, `"${profile.version}"`)
  return { profile, etag }
}

export function createCommunityApi(client: AxiosInstance): CommunityApi {
  const command = (key: string) => ({
    headers: { 'Idempotency-Key': commandKeySchema.parse(key) },
  })
  const match = (etag: string) => ({
    headers: { 'If-Match': etagSchema.parse(etag) },
  })
  return {
    async feed(topics, cursor) {
      const params = new URLSearchParams({ limit: '20' })
      if (topics.length)
        postWriteSchema.shape.topics
          .parse(topics)
          .forEach((topic) => params.append('topic', topic))
      if (cursor) params.set('cursor', z.string().max(256).parse(cursor))
      return feedPageSchema.parse(
        (await client.get(`${root}/feed`, { params })).data,
      )
    },
    async saved(cursor) {
      return feedPageSchema.parse(
        (
          await client.get(`${root}/saved-posts`, {
            params: { limit: 20, ...(cursor ? { cursor } : {}) },
          })
        ).data,
      )
    },
    async topics() {
      return topicsSchema.parse((await client.get(`${root}/topics`)).data)
    },
    async detail(id) {
      const response = await client.get(`${root}/posts/${pathId(id)}`)
      return versionedPost(response.data, response.headers.etag, id)
    },
    async create(body, key) {
      const response = await client.post(
        `${root}/posts`,
        postWriteSchema.parse(body),
        command(key),
      )
      return versionedPost(
        response.data,
        response.headers.etag,
        undefined,
        true,
      )
    },
    async update(id, etag, body) {
      const response = await client.patch(
        `${root}/posts/${pathId(id)}`,
        postWriteSchema.parse(body),
        match(etag),
      )
      return versionedPost(response.data, response.headers.etag, id, true)
    },
    async remove(id, etag) {
      await client.delete(`${root}/posts/${pathId(id)}`, match(etag))
    },
    async profile() {
      try {
        const response = await client.get(`${root}/profile`)
        return versionedProfile(response.data, response.headers.etag)
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
    async saveProfile(body, etag) {
      const response = await client.put(
        `${root}/profile`,
        profileWriteSchema.parse(body),
        etag ? match(etag) : undefined,
      )
      return versionedProfile(response.data, response.headers.etag)
    },
    async comments(postId, cursor) {
      const response = await client.get(
        `${root}/posts/${pathId(postId)}/comments`,
        { params: { limit: 20, ...(cursor ? { cursor } : {}) } },
      )
      const page = commentPageSchema.parse(response.data)
      page.items.forEach((comment) => identity(comment.postId, postId))
      return page
    },
    async comment(postId, content, parentId, key) {
      const response = await client.post(
        `${root}/posts/${pathId(postId)}/comments`,
        commentWriteSchema.parse({ content, parentCommentId: parentId }),
        command(key),
      )
      const comment = commentSchema.parse(response.data)
      identity(comment.postId, postId)
      identity(etagSchema.parse(response.headers.etag), `"${comment.version}"`)
      if (comment.parentCommentId !== parentId)
        throw new ApiError({
          code: 'COMMUNITY_CONTRACT_MISMATCH',
          message: 'Reply target mismatch.',
          status: 502,
        })
      return comment
    },
    async react(postId, reaction) {
      const path = `${root}/posts/${pathId(postId)}/reaction`
      if (reaction === null) await client.delete(path)
      else {
        const response = await client.put(path, {
          reaction: reactionSchema.parse(reaction),
        })
        const result = reactionResultSchema.parse(response.data)
        identity(result.postId, postId)
        identity(result.reaction, reaction)
      }
    },
    async bookmark(postId, saved) {
      const path = `${root}/posts/${pathId(postId)}/bookmark`
      if (saved) await client.put(path)
      else await client.delete(path)
    },
    async report(body, key) {
      await client.post(
        `${root}/reports`,
        reportWriteSchema.parse(body),
        command(key),
      )
    },
    async block(profileId) {
      await client.put(`${root}/blocks/${pathId(profileId)}`)
    },
    async hide(type, id) {
      await client.put(`${root}/hidden-content/${type}/${pathId(id)}`)
    },
    async uploadIntent(body, key) {
      return uploadIntentSchema.parse(
        (
          await client.post(
            `${root}/media/upload-intents`,
            uploadWriteSchema.parse(body),
            command(key),
          )
        ).data,
      )
    },
    async finalize(mediaId) {
      const record = mediaRecordSchema.parse(
        (await client.post(`${root}/media/${pathId(mediaId)}/finalize`)).data,
      )
      identity(record.mediaId, mediaId)
      return record
    },
    async removeMedia(mediaId, version) {
      await client.delete(
        `${root}/media/${pathId(mediaId)}`,
        match(`"${version}"`),
      )
    },
  }
}
