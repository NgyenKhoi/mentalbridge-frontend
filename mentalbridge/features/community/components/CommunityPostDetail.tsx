'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import { ApiError } from '@/lib/api/api-error'
import {
  getCommunityPost,
  getCommunityTopics,
  type CommunityPostDetail as Post,
  type CommunityTopic,
} from '@/features/community/api/browser-community'
import CommunityMedia from './CommunityMedia'

function communityTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function CommunityPostDetail({ postId }: { postId: string }) {
  const [post, setPost] = useState<Post>()
  const [topics, setTopics] = useState<CommunityTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([getCommunityPost(postId), getCommunityTopics()])
      .then(([postValue, topicValues]) => {
        if (!active) return
        setPost(postValue)
        setTopics(topicValues)
      })
      .catch((cause) => {
        if (!active) return
        setMessage(
          cause instanceof ApiError && cause.status === 404
            ? 'Bài viết này không còn khả dụng.'
            : 'Bài viết tạm thời chưa tải được.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [postId])

  if (loading) {
    return (
      <section
        className="community-state community-detail-state"
        role="status"
        aria-busy="true"
      >
        <h1>Đang tải bài viết…</h1>
      </section>
    )
  }
  if (!post || message) {
    return (
      <section className="community-state community-detail-state" role="alert">
        <h1>{message || 'Bài viết này không còn khả dụng.'}</h1>
        <Link href="/community">Trở về bảng tin</Link>
      </section>
    )
  }

  return (
    <div className="community-detail-page">
      <Link className="community-back" href="/community">
        ← Trở về bảng tin
      </Link>
      <article className="community-detail">
        <header>
          <div
            className={`community-avatar ${post.author.state === 'DELETED' ? 'is-deleted' : ''}`}
            aria-hidden="true"
          >
            {post.author.state === 'DELETED'
              ? '—'
              : post.author.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{post.author.displayName}</strong>
            <time dateTime={post.publishedAt}>
              {communityTime(post.publishedAt)}
            </time>
          </div>
        </header>
        <div className="community-card-topics">
          {post.topics.map((topic) => (
            <span key={topic}>
              {topics.find((value) => value.code === topic)?.label ?? topic}
            </span>
          ))}
        </div>
        <p className="community-detail-copy">{post.content}</p>
        <CommunityMedia media={post.media} />
        {post.mediaAvailability === 'PARTIAL' && (
          <p className="community-media-note">
            Một số nội dung đa phương tiện đang được xử lý.
          </p>
        )}
        {post.mediaAvailability === 'UNAVAILABLE' && (
          <p className="community-media-note">
            Nội dung đa phương tiện hiện chưa khả dụng.
          </p>
        )}
        <footer>
          <span>♡ {post.counts.reactions} lượt đồng cảm</span>
          <span>◇ {post.counts.comments} bình luận</span>
        </footer>
      </article>
      <aside className="community-safety-note">
        <strong>Chia sẻ từ cộng đồng</strong>
        <p>
          Nội dung thể hiện trải nghiệm cá nhân, không thay thế tư vấn chuyên
          môn hoặc hỗ trợ khẩn cấp.
        </p>
      </aside>
    </div>
  )
}
