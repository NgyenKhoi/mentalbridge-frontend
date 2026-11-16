import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { fixturePost, fixturePostId } from './community-fixtures'
import type { CommunityApi } from './community-api'
import type { CommentReaction, VersionedPost } from './community-contract'
import {
  useCommentReactions,
  usePostCommands,
} from './community-reaction-hooks'

const subject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const commentId = '44444444-4444-4444-8444-444444444444'
const failure = new Error('network')

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

describe('usePostCommands', () => {
  it('keeps the newer choice when an earlier queued reaction fails', async () => {
    const { client, wrapper } = setup()
    const postKey = ['community', subject, 'post', fixturePostId]
    client.setQueryData<VersionedPost>(postKey, {
      post: fixturePost,
      etag: null,
    })
    const api = {
      react: jest
        .fn()
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(undefined),
    } as unknown as CommunityApi
    const { result } = await renderHook(() => usePostCommands(api, subject), {
      wrapper,
    })
    await act(async () => {
      const first = result.current.react(fixturePost, 'SUPPORT')
      const second = result.current.react(
        {
          ...fixturePost,
          counts: { ...fixturePost.counts, reactions: 1 },
          viewerState: { ...fixturePost.viewerState, reaction: 'SUPPORT' },
        },
        'RELATE',
      )
      await first
      await second
    })
    expect(api.react).toHaveBeenNthCalledWith(2, fixturePostId, 'RELATE')
    const post = client.getQueryData<VersionedPost>(postKey)!.post
    expect(post.viewerState.reaction).toBe('RELATE')
    expect(post.counts.reactions).toBe(1)
  })

  it('restores the confirmed state when every queued reaction fails', async () => {
    const { client, wrapper } = setup()
    const postKey = ['community', subject, 'post', fixturePostId]
    client.setQueryData<VersionedPost>(postKey, {
      post: fixturePost,
      etag: null,
    })
    const api = {
      react: jest.fn().mockRejectedValue(failure),
    } as unknown as CommunityApi
    const { result } = await renderHook(() => usePostCommands(api, subject), {
      wrapper,
    })
    await act(async () => {
      const first = result.current.react(fixturePost, 'SUPPORT')
      const second = result.current.react(
        {
          ...fixturePost,
          viewerState: { ...fixturePost.viewerState, reaction: 'SUPPORT' },
        },
        'RELATE',
      )
      await first
      await second
    })
    expect(
      client.getQueryData<VersionedPost>(postKey)!.post.viewerState.reaction,
    ).toBeNull()
  })
})

describe('useCommentReactions', () => {
  const comment = {
    commentId,
    state: 'ACTIVE',
  } as unknown as Parameters<typeof useCommentReactions>[2][number]
  const none: CommentReaction = { commentId, reaction: null, reactionCount: 0 }

  it('sends the cleared intent after a rapid set then clear', async () => {
    const { client, wrapper } = setup()
    let release!: (value: CommentReaction) => void
    const api = {
      commentReaction: jest.fn().mockResolvedValue(none),
      setCommentReaction: jest.fn(
        () => new Promise<CommentReaction>((resolve) => (release = resolve)),
      ),
      clearCommentReaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as CommunityApi
    const { result } = await renderHook(
      () => useCommentReactions(api, subject, [comment]),
      { wrapper },
    )
    await waitFor(() => expect(result.current.of(commentId)).toEqual(none))
    await act(async () => {
      void result.current.react(commentId, 'SUPPORT')
      void result.current.react(commentId, null)
    })
    await act(async () => {
      release({ commentId, reaction: 'SUPPORT', reactionCount: 1 })
    })
    await waitFor(() =>
      expect(api.clearCommentReaction).toHaveBeenCalledWith(commentId),
    )
    await waitFor(() =>
      expect(result.current.of(commentId)).toEqual({
        commentId,
        reaction: null,
        reactionCount: 0,
      }),
    )
    expect(
      client.getQueryData([
        'community',
        subject,
        'comment-reaction',
        commentId,
      ]),
    ).toMatchObject({ reaction: null, reactionCount: 0 })
  })
})
