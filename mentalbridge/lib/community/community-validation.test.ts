import { describe, expect, it } from 'vitest'

import {
  parseCommunityFeedPage,
  parseCommunityProfile,
  parseCommunityProfileInput,
  parseCommunityPostDetail,
  parseCommunityPostWrite,
  parseCommunityTopics,
  parseOwnerVersion,
} from './community-validation'

const post = {
  postId: '20000000-0000-4000-8000-000000000009',
  author: {
    communityProfileId: '10000000-0000-4000-8000-000000000002',
    avatarPreset: 'LEAF',
    displayName: 'Minh An',
    state: 'ACTIVE',
  },
  topics: ['MY_STORY'],
  media: [
    {
      mediaId: '30000000-0000-4000-8000-000000000001',
      type: 'IMAGE',
      url: 'https://media.example.test/story.webp',
      width: 1200,
      height: 800,
      durationSeconds: null,
      altText: 'Hình minh họa',
    },
  ],
  mediaAvailability: 'READY',
  counts: { comments: 2, reactions: 3 },
  publishedAt: '2026-09-29T05:00:00Z',
  updatedAt: '2026-09-29T05:00:00Z',
}

describe('Community response validation', () => {
  it('accepts contract-shaped feed and detail payloads', () => {
    expect(
      parseCommunityFeedPage({
        items: [{ ...post, contentPreview: 'Một câu chuyện.' }],
        nextCursor: null,
        hasMore: false,
      }),
    ).not.toBeNull()
    expect(
      parseCommunityPostDetail({ ...post, content: 'Nội dung đầy đủ.' }),
    ).not.toBeNull()
  })

  it('accepts both rollout author shapes and normalizes the legacy avatar', () => {
    const legacyAuthor = {
      communityProfileId: post.author.communityProfileId,
      displayName: post.author.displayName,
      state: post.author.state,
    }
    const legacyFeed = parseCommunityFeedPage({
      items: [
        { ...post, author: legacyAuthor, contentPreview: 'Một câu chuyện.' },
      ],
      nextCursor: null,
      hasMore: false,
    })
    const currentFeed = parseCommunityFeedPage({
      items: [{ ...post, contentPreview: 'Một câu chuyện.' }],
      nextCursor: null,
      hasMore: false,
    })
    const legacyDetail = parseCommunityPostDetail({
      ...post,
      author: legacyAuthor,
      content: 'Nội dung đầy đủ.',
    })
    const currentDetail = parseCommunityPostDetail({
      ...post,
      content: 'Nội dung đầy đủ.',
    })

    expect(legacyFeed?.items[0].author.avatarPreset).toBeNull()
    expect(legacyDetail?.author.avatarPreset).toBeNull()
    expect(currentFeed?.items[0].author.avatarPreset).toBe('LEAF')
    expect(currentDetail?.author.avatarPreset).toBe('LEAF')
    expect(
      parseCommunityPostDetail({
        ...post,
        author: {
          ...legacyAuthor,
          accountSubject: '00000000-0000-4000-8000-000000000001',
        },
        content: 'Nội dung đầy đủ.',
      }),
    ).toBeNull()
  })

  it('measures user text limits by Unicode code point', () => {
    const emoji = '🙂'
    expect(
      parseCommunityFeedPage({
        items: [
          {
            ...post,
            author: { ...post.author, displayName: emoji.repeat(80) },
            contentPreview: emoji.repeat(421),
          },
        ],
        nextCursor: null,
        hasMore: false,
      }),
    ).not.toBeNull()
    expect(
      parseCommunityPostDetail({ ...post, content: emoji.repeat(5000) }),
    ).not.toBeNull()

    expect(
      parseCommunityFeedPage({
        items: [
          {
            ...post,
            author: { ...post.author, displayName: emoji.repeat(81) },
            contentPreview: emoji.repeat(421),
          },
        ],
        nextCursor: null,
        hasMore: false,
      }),
    ).toBeNull()
    expect(
      parseCommunityFeedPage({
        items: [{ ...post, contentPreview: emoji.repeat(422) }],
        nextCursor: null,
        hasMore: false,
      }),
    ).toBeNull()
    expect(
      parseCommunityPostDetail({ ...post, content: emoji.repeat(5001) }),
    ).toBeNull()
    expect(
      parseCommunityPostWrite({
        content: emoji.repeat(5000),
        topics: ['MY_STORY'],
        mediaIds: [],
      }),
    ).not.toBeNull()
    expect(
      parseCommunityPostWrite({
        content: emoji.repeat(5001),
        topics: ['MY_STORY'],
        mediaIds: [],
      }),
    ).toBeNull()
  })

  it('accepts only quoted safe owner versions', () => {
    expect(parseOwnerVersion('"0"')).toBe(0)
    expect(parseOwnerVersion('"42"')).toBe(42)
    expect(parseOwnerVersion('42')).toBeNull()
    expect(parseOwnerVersion('"01"')).toBeNull()
  })

  it('rejects unsafe media URLs and inconsistent cursor state', () => {
    expect(
      parseCommunityPostDetail({
        ...post,
        content: 'Nội dung đầy đủ.',
        media: [{ ...post.media[0], url: 'javascript:alert(1)' }],
      }),
    ).toBeNull()
    expect(
      parseCommunityFeedPage({ items: [], nextCursor: null, hasMore: true }),
    ).toBeNull()
  })

  it('rejects undeclared fields so private owner or health data cannot cross the BFF', () => {
    expect(
      parseCommunityPostDetail({
        ...post,
        content: 'Nội dung đầy đủ.',
        accountSubject: '00000000-0000-4000-8000-000000000001',
      }),
    ).toBeNull()
    expect(
      parseCommunityFeedPage({
        items: [
          {
            ...post,
            contentPreview: 'Một câu chuyện.',
            inferredEmotion: 'SAD',
          },
        ],
        nextCursor: null,
        hasMore: false,
      }),
    ).toBeNull()
  })

  it('requires the complete unique governed topic catalogue', () => {
    const topics = [
      'MY_STORY',
      'SMALL_MILESTONE',
      'HELPFUL_REFLECTION',
      'PEER_QUESTION',
      'EXPERIENCE_SHARING',
      'HELPFUL_RESOURCE',
    ].map((code) => ({ code, label: code, description: `Mô tả ${code}` }))

    expect(parseCommunityTopics(topics)).not.toBeNull()
    expect(parseCommunityTopics(topics.slice(0, 5))).toBeNull()
    expect(parseCommunityTopics([...topics.slice(0, 5), topics[0]])).toBeNull()
  })

  it('accepts only the bounded public Community display identity contract', () => {
    const profile = {
      communityProfileId: '10000000-0000-4000-8000-000000000002',
      displayName: '🌿'.repeat(80),
      avatarPreset: 'LEAF',
      status: 'ACTIVE',
      version: 1,
      createdAt: '2026-09-29T05:00:00Z',
      updatedAt: '2026-09-29T05:10:00Z',
    }
    expect(parseCommunityProfile(profile)).not.toBeNull()
    expect(
      parseCommunityProfile({
        ...profile,
        accountSubject: '00000000-0000-4000-8000-000000000001',
      }),
    ).toBeNull()
    expect(
      parseCommunityProfileInput({
        displayName: 'Mầm Xanh',
        avatarPreset: null,
      }),
    ).not.toBeNull()
    expect(
      parseCommunityProfileInput({
        displayName: 'Mầm Xanh',
        avatarPreset: 'https://example.test/me.png',
      }),
    ).toBeNull()
  })
})
