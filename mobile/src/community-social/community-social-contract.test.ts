import {
  circleDetailSchema,
  circleEntrySchema,
  circlePageSchema,
  createCircleSchema,
  friendshipPageSchema,
  friendshipSchema,
  friendshipStateSchema,
  memberIdentitySchema,
  memberPageSchema,
  memberProfileSchema,
  searchTermSchema,
  writeEntrySchema,
} from './community-social-contract'
import {
  circle,
  circleDetail,
  entry,
  friendship,
  friendshipId,
  memberProfile,
  peer,
  peerId,
} from './community-social-fixtures'

describe('Community social v1 boundary', () => {
  it('accepts friendships and member pages and rejects extra fields or invalid ids', () => {
    expect(friendshipSchema.safeParse(friendship('INCOMING')).success).toBe(
      true,
    )
    expect(
      friendshipPageSchema.safeParse({
        items: [friendship('FRIENDS')],
        nextCursor: peerId,
      }).success,
    ).toBe(true)
    expect(
      memberPageSchema.safeParse({ items: [peer], nextCursor: null }).success,
    ).toBe(true)
    for (const invalid of [
      { ...friendship('FRIENDS'), email: 'a@b.c' },
      { ...friendship('FRIENDS'), state: 'SELF' },
      { ...friendship('FRIENDS'), friendshipId: 'nope' },
    ])
      expect(friendshipSchema.safeParse(invalid).success).toBe(false)
    expect(
      memberPageSchema.safeParse({ items: [peer], nextCursor: 'not-a-uuid' })
        .success,
    ).toBe(false)
  })

  it('only admits ACTIVE named members: no anonymous, deleted or id-less identities', () => {
    expect(memberIdentitySchema.safeParse(peer).success).toBe(true)
    for (const invalid of [
      { ...peer, state: 'DELETED', avatarPreset: null },
      {
        ...peer,
        state: 'ANONYMOUS',
        communityProfileId: null,
        avatarPreset: null,
      },
      { ...peer, communityProfileId: null },
    ])
      expect(memberIdentitySchema.safeParse(invalid).success).toBe(false)
  })

  it('ties a friendship state to its request id', () => {
    for (const state of ['SELF', 'NONE'] as const)
      expect(
        friendshipStateSchema.safeParse({ state, friendshipId: null }).success,
      ).toBe(true)
    expect(
      friendshipStateSchema.safeParse({ state: 'NONE', friendshipId }).success,
    ).toBe(false)
    expect(
      friendshipStateSchema.safeParse({ state: 'FRIENDS', friendshipId: null })
        .success,
    ).toBe(false)
  })

  it('parses a member page with its visible named posts and rejects extra top-level fields', () => {
    expect(memberProfileSchema.safeParse(memberProfile('NONE')).success).toBe(
      true,
    )
    expect(
      memberProfileSchema.safeParse({
        ...memberProfile('NONE'),
        friends: [],
      }).success,
    ).toBe(false)
  })

  it('bounds the search term to 2 to 80 code points', () => {
    expect(searchTermSchema.safeParse('a').success).toBe(false)
    expect(searchTermSchema.safeParse('ab').success).toBe(true)
    expect(searchTermSchema.safeParse('a'.repeat(81)).success).toBe(false)
    expect(searchTermSchema.safeParse('😀'.repeat(80)).success).toBe(true)
  })

  it('validates circles, details, text entries and writes', () => {
    expect(
      circlePageSchema.safeParse({ items: [circle()], nextCursor: null })
        .success,
    ).toBe(true)
    expect(circleDetailSchema.safeParse(circleDetail('OWNER')).success).toBe(
      true,
    )
    expect(circleEntrySchema.safeParse(entry({ author: null })).success).toBe(
      true,
    )
    for (const invalid of [
      { ...circle(), memberCount: 0 },
      { ...circle(), membership: 'LEFT' },
      { ...circle(), media: [] },
    ])
      expect(
        circlePageSchema.safeParse({ items: [invalid], nextCursor: null })
          .success,
      ).toBe(false)
    expect(
      circleEntrySchema.safeParse({ ...entry(), media: [], createdAt: 'x' })
        .success,
    ).toBe(false)
    expect(writeEntrySchema.safeParse({ text: '  ' }).success).toBe(false)
    expect(writeEntrySchema.safeParse({ text: 'Chào cả nhà' }).success).toBe(
      true,
    )
    expect(
      createCircleSchema.safeParse({
        name: 'Nhóm',
        description: '',
        invitees: [peerId, peerId],
      }).success,
    ).toBe(false)
    expect(
      createCircleSchema.safeParse({
        name: 'Nhóm',
        description: '',
        invitees: [peerId],
        extra: 1,
      }).success,
    ).toBe(false)
  })
})
