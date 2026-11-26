import {
  useQueries,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { ApiError } from '@/api/api-error'

import type { CommunityApi } from './community-api'
import type {
  CommentReaction,
  CommunityComment,
  CommunityPage,
  Reaction,
  VersionedPost,
} from './community-contract'
import { nextReactionCount } from './community-reactions'
import { communityMessage } from './community-ui'

type PostState = Readonly<{
  postId: string
  counts: { reactions: number }
  viewerState: { reaction: Reaction | null; bookmarked: boolean }
}>
type Delta = {
  reaction?: Reaction | null
  reactions?: number
  bookmarked?: boolean
}

const apply = <T extends PostState>(post: T, delta: Delta): T => ({
  ...post,
  counts: {
    ...post.counts,
    ...(delta.reactions === undefined ? {} : { reactions: delta.reactions }),
  },
  viewerState: {
    ...post.viewerState,
    ...(delta.reaction === undefined ? {} : { reaction: delta.reaction }),
    ...(delta.bookmarked === undefined ? {} : { bookmarked: delta.bookmarked }),
  },
})

const hiddenStatus = (failure: unknown) =>
  failure instanceof ApiError && [401, 403, 404].includes(failure.status ?? 0)

/**
 * Reaction and bookmark commands for a post, shared by the feed, the detail and the moments viewer.
 * The feed pages and the post detail cache are patched at once and restored if the command fails.
 */
export function usePostCommands(
  api: CommunityApi,
  subject: string,
  onGone?: () => Promise<void> | void,
) {
  const client = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  // One post's commands run in tap order, so a quick second tap never overtakes the first.
  const chain = useRef(new Map<string, Promise<void>>())
  // Server-confirmed fields per post, and how many commands are queued, so a failure never
  // restores over a newer optimistic choice.
  const settled = useRef(new Map<string, Delta>())
  const queued = useRef(new Map<string, number>())
  const run = (
    postId: string,
    next: Delta,
    undo: Delta,
    command: () => Promise<void>,
  ) => {
    const patch = (delta: Delta) => {
      client.setQueriesData<InfiniteData<CommunityPage, string | undefined>>(
        {
          predicate: ({ queryKey }) =>
            queryKey[0] === 'community' &&
            queryKey[1] === subject &&
            (queryKey[2] === 'feed' || queryKey[2] === 'saved'),
        },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.postId === postId ? apply(item, delta) : item,
              ),
            })),
          },
      )
      client.setQueryData<VersionedPost>(
        ['community', subject, 'post', postId],
        (value) => value && { ...value, post: apply(value.post, delta) },
      )
    }
    const depth = queued.current.get(postId) ?? 0
    // Idle post: the cache still equals the server, so `undo` is the confirmed state.
    if (!depth)
      settled.current.set(postId, { ...settled.current.get(postId), ...undo })
    queued.current.set(postId, depth + 1)
    patch(next)
    setError(null)
    const task = (chain.current.get(postId) ?? Promise.resolve()).then(
      async () => {
        try {
          await command()
          settled.current.set(postId, {
            ...settled.current.get(postId),
            ...next,
          })
        } catch (failure) {
          // A later queued command owns the cache now; only the last one restores.
          if (queued.current.get(postId) === 1)
            patch(settled.current.get(postId) ?? undo)
          setError(communityMessage(failure))
          if (hiddenStatus(failure)) await onGone?.()
        } finally {
          queued.current.set(postId, (queued.current.get(postId) ?? 1) - 1)
        }
      },
    )
    chain.current.set(postId, task)
    return task
  }
  return {
    error,
    react: (post: PostState, next: Reaction | null) =>
      run(
        post.postId,
        {
          reaction: next,
          reactions: nextReactionCount(
            post.counts.reactions,
            post.viewerState.reaction,
            next,
          ),
        },
        {
          reaction: post.viewerState.reaction,
          reactions: post.counts.reactions,
        },
        () => api.react(post.postId, next),
      ),
    bookmark: (post: PostState, saved: boolean) =>
      run(
        post.postId,
        { bookmarked: saved },
        { bookmarked: post.viewerState.bookmarked },
        () => api.bookmark(post.postId, saved),
      ),
  }
}

const commentReactionKey = (subject: string, commentId: string) =>
  ['community', subject, 'comment-reaction', commentId] as const

/**
 * Each loaded, visible comment gets its own reaction query. A transient read failure is retried
 * twice; a comment the server reports unavailable, or one still failing, has no entry, so its
 * control stays hidden; there is no per-comment error state.
 */
export function useCommentReactions(
  api: CommunityApi,
  subject: string,
  comments: readonly CommunityComment[],
) {
  const client = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  // The newest wanted reaction per comment with a write in flight; sent when that write settles.
  const inflight = useRef(new Map<string, { latest: Reaction | null }>())
  const visible = comments.filter((comment) => comment.state === 'ACTIVE')
  const results = useQueries({
    queries: visible.map((comment) => ({
      queryKey: commentReactionKey(subject, comment.commentId),
      queryFn: () => api.commentReaction(comment.commentId),
      retry: (count: number, failure: unknown) =>
        count < 2 && !hiddenStatus(failure),
    })),
  })
  const byId = new Map(
    visible.map((comment, index) => [comment.commentId, results[index]?.data]),
  )
  const react = async (commentId: string, next: Reaction | null) => {
    const key = commentReactionKey(subject, commentId)
    const before = client.getQueryData<CommentReaction>(key)
    if (!before) return
    setError(null)
    client.setQueryData<CommentReaction>(key, {
      ...before,
      reaction: next,
      reactionCount: nextReactionCount(
        before.reactionCount,
        before.reaction,
        next,
      ),
    })
    const active = inflight.current.get(commentId)
    if (active) {
      active.latest = next
      return
    }
    const entry = { latest: next }
    inflight.current.set(commentId, entry)
    // `confirmed` is what the server holds; the cache is rolled back to it on failure.
    let confirmed = before
    try {
      let sent: Reaction | null
      do {
        sent = entry.latest
        if (sent) confirmed = await api.setCommentReaction(commentId, sent)
        else {
          await api.clearCommentReaction(commentId)
          confirmed = {
            ...confirmed,
            reaction: null,
            reactionCount: nextReactionCount(
              confirmed.reactionCount,
              confirmed.reaction,
              null,
            ),
          }
        }
      } while (entry.latest !== sent)
      client.setQueryData(key, confirmed)
    } catch (failure) {
      client.setQueryData(key, confirmed)
      setError(communityMessage(failure))
    } finally {
      inflight.current.delete(commentId)
    }
  }
  return { error, react, of: (commentId: string) => byId.get(commentId) }
}
