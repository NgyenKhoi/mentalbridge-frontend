import {
  authorSchema,
  commentSchema,
  feedPageSchema,
  postDetailSchema,
  postWriteSchema,
  uploadIntentSchema,
  uploadWriteSchema,
} from './community-contract'
import {
  fixtureDate,
  fixturePost,
  fixturePostId,
  fixtureSummary,
} from './community-fixtures'

describe('Community v1.10 public boundary', () => {
  it('accepts only the public post projection, without health or private owner fields', () => {
    expect(postDetailSchema.parse(fixturePost)).toEqual(fixturePost)
    for (const field of [
      'actorId',
      'accountId',
      'ownerAccountId',
      'phq9Score',
      'journalText',
      'sentiment',
    ]) {
      expect(
        postDetailSchema.safeParse({ ...fixturePost, [field]: 'private' })
          .success,
      ).toBe(false)
    }
  })
  it('fails closed on anonymous linkage and unknown author or viewer semantics', () => {
    const anonymous = {
      communityProfileId: null,
      displayName: 'Ẩn danh',
      avatarPreset: null,
      state: 'ANONYMOUS',
    }
    expect(authorSchema.safeParse(anonymous).success).toBe(true)
    expect(
      authorSchema.safeParse({
        ...fixturePost.author,
        state: 'DELETED',
        avatarPreset: null,
      }).success,
    ).toBe(true)
    expect(
      authorSchema.safeParse({
        ...anonymous,
        communityProfileId: fixturePostId,
      }).success,
    ).toBe(false)
    expect(
      authorSchema.safeParse({ ...anonymous, avatarPreset: 'LEAF' }).success,
    ).toBe(false)
    expect(
      postDetailSchema.safeParse({
        ...fixturePost,
        viewerState: { reaction: 'LIKE', bookmarked: false },
      }).success,
    ).toBe(false)
  })
  it('preserves opaque pagination and refuses malformed continuation or unavailable media leakage', () => {
    const page = {
      items: [fixtureSummary],
      nextCursor: 'opaque-not-an-id',
      hasMore: true,
    }
    expect(feedPageSchema.parse(page).nextCursor).toBe('opaque-not-an-id')
    expect(
      feedPageSchema.safeParse({ ...page, nextCursor: null }).success,
    ).toBe(false)
    expect(
      postDetailSchema.safeParse({
        ...fixturePost,
        mediaAvailability: 'UNAVAILABLE',
        media: [
          {
            mediaId: fixturePostId,
            type: 'IMAGE',
            url: 'https://example.com/image',
            width: null,
            height: null,
            durationSeconds: null,
            altText: null,
          },
        ],
      }).success,
    ).toBe(false)
  })
  it('allows supported tombstones without rendering their returned content as an active comment', () => {
    expect(
      commentSchema.parse({
        commentId: fixturePostId,
        postId: fixturePostId,
        parentCommentId: null,
        author: fixturePost.author,
        content: 'Bình luận đã bị xóa.',
        state: 'OWNER_DELETED',
        version: 1,
        createdAt: fixtureDate,
        updatedAt: fixtureDate,
      }).state,
    ).toBe('OWNER_DELETED')
  })
  it('bounds topic, identity, warning and media writes without actor or clinical payloads', () => {
    const body = {
      content: 'Một chia sẻ',
      topics: ['MY_STORY'],
      mediaIds: [],
      authorMode: 'ANONYMOUS',
      resourceId: null,
      sensitiveContentWarning: null,
    }
    expect(postWriteSchema.safeParse(body).success).toBe(true)
    expect(
      postWriteSchema.safeParse({ ...body, actorId: fixturePostId }).success,
    ).toBe(false)
    expect(
      postWriteSchema.safeParse({ ...body, topics: ['MY_STORY', 'MY_STORY'] })
        .success,
    ).toBe(false)
    expect(
      postWriteSchema.safeParse({
        ...body,
        sensitiveContentWarning: 'HIGH_RISK',
      }).success,
    ).toBe(false)
  })
  it('allowlists bounded upload formats and credential-free provider targets', () => {
    expect(
      uploadWriteSchema.safeParse({
        fileName: 'story.jpg',
        mediaType: 'IMAGE',
        mimeType: 'image/jpeg',
        sizeBytes: 10_485_760,
      }).success,
    ).toBe(true)
    expect(
      uploadWriteSchema.safeParse({
        fileName: 'story.jpg',
        mediaType: 'IMAGE',
        mimeType: 'image/jpeg',
        sizeBytes: 10_485_761,
      }).success,
    ).toBe(false)
    const intent = {
      mediaId: fixturePostId,
      state: 'PENDING',
      version: 0,
      uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
      expiresAt: fixtureDate,
      uploadFields: { signature: 'signed', timestamp: '1' },
    }
    expect(uploadIntentSchema.safeParse(intent).success).toBe(true)
    for (const url of [
      'https://evil.test/upload',
      'http://api.cloudinary.com/upload',
      'https://user:pass@api.cloudinary.com/upload',
    ])
      expect(
        uploadIntentSchema.safeParse({ ...intent, uploadUrl: url }).success,
      ).toBe(false)
  })
})
