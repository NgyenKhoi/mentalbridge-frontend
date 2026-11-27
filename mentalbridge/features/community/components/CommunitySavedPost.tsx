'use client'

import Link from 'next/link'
import { ArrowUpRight, Bookmark, MessageSquare } from 'lucide-react'
import { Disclosure } from '@/components/ui/Disclosure'
import type {
  CommunityFeedPage,
  CommunityTopic,
} from '../api/browser-community'
import type { CommunityViewerState } from '@/lib/community/community-validation'
import CommunityAvatar from './CommunityAvatar'
import CommunityAuthorLink from './CommunityAuthorLink'
import CommunityInteractions from './CommunityInteractions'
import CommunityMedia from './CommunityMedia'
import CommunityResourceAttachment from './CommunityResourceAttachment'
import CommunitySafetyActions from './CommunitySafetyActions'
import CommunitySensitiveContent from './CommunitySensitiveContent'
import styles from './CommunitySavedPost.module.css'

export default function CommunitySavedPost({
  post,
  topics,
  onComment,
  onChange,
  onHidden,
}: {
  post: CommunityFeedPage['items'][number]
  topics: readonly CommunityTopic[]
  onComment: (trigger: HTMLButtonElement) => void
  onChange: (state: CommunityViewerState, reactions: number) => void
  onHidden: () => void
}) {
  const href = `/community/${post.postId}`
  const media = post.media[0]
  const type =
    media?.type === 'VIDEO'
      ? 'Video'
      : media?.type === 'IMAGE'
        ? 'Ảnh'
        : post.resourceAttachment
          ? 'Tài nguyên'
          : 'Bài viết'

  return (
    <article className={styles.row}>
      <CommunitySensitiveContent
        warned={post.sensitiveContentWarning === 'SENSITIVE_CONTENT'}
      >
        <div className={styles.preview}>
          <div className={styles.thumbnail}>
            {media ? (
              <CommunityMedia media={post.media} compact />
            ) : (
              <Link
                href={href}
                className={styles.textThumbnail}
                aria-label={`Đọc bài viết của ${post.author.displayName}`}
              >
                <Bookmark size={28} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  {post.mediaAvailability === 'UNAVAILABLE'
                    ? 'Nội dung chưa khả dụng'
                    : type}
                </span>
              </Link>
            )}
          </div>
          <div className={styles.content}>
            <div className={styles.meta}>
              <span>{type}</span>
              {post.topics.map((topic) => (
                <span key={topic}>
                  {topics.find((value) => value.code === topic)?.label ?? topic}
                </span>
              ))}
            </div>
            <h2 className={styles.excerpt}>
              <Link href={href}>
                {post.contentPreview ||
                  `Bài viết của ${post.author.displayName}`}
              </Link>
            </h2>
            <div className={styles.author}>
              <CommunityAuthorLink author={post.author}>
                <CommunityAvatar
                  displayName={post.author.displayName}
                  avatarPreset={post.author.avatarPreset}
                  avatarImage={post.author.avatarImage}
                  deleted={post.author.state === 'DELETED'}
                  anonymous={post.author.state === 'ANONYMOUS'}
                />
              </CommunityAuthorLink>
              <div>
                <strong>
                  <CommunityAuthorLink author={post.author} />
                </strong>
                <time dateTime={post.publishedAt}>
                  Đăng{' '}
                  {new Intl.DateTimeFormat('vi-VN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(post.publishedAt))}
                </time>
              </div>
            </div>
          </div>
        </div>
      </CommunitySensitiveContent>
      <footer className={styles.actions}>
        <Link href={href} className={styles.read}>
          Đọc bài viết <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <button
          type="button"
          aria-label={`Bình luận bài viết của ${post.author.displayName}`}
          aria-haspopup="dialog"
          onClick={(event) => onComment(event.currentTarget)}
        >
          <MessageSquare size={16} aria-hidden="true" />
          {post.counts.comments} bình luận
        </button>
        <Disclosure
          className={styles.options}
          summary="Lưu & tương tác"
          summaryLabel={`Lưu và tương tác với bài viết của ${post.author.displayName}`}
        >
          {post.viewerState && (
            <CommunityInteractions
              postId={post.postId}
              viewerState={post.viewerState}
              reactionCount={post.counts.reactions}
              onChange={onChange}
            />
          )}
          {post.resourceAttachment && (
            <CommunityResourceAttachment
              resourceId={post.resourceAttachment.resourceId}
            />
          )}
          <CommunitySafetyActions
            targetType="POST"
            targetId={post.postId}
            communityProfileId={post.author.communityProfileId}
            onHidden={onHidden}
          />
        </Disclosure>
      </footer>
    </article>
  )
}
