'use client'

import { useEffect, useId } from 'react'
import Link from 'next/link'
import { ArrowUpRight, X } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import type { CommunityPostDetail as Post } from '../api/browser-community'
import CommunityPostDetail from './CommunityPostDetail'
import styles from './CommunityCommentsDialog.module.css'

type Props = Readonly<{
  postId: string
  authorName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onPostChange: (post: Post) => void
  onUnavailable: () => void
  restoreFocusTo: () => HTMLElement | null
}>

export default function CommunityCommentsDialog({
  postId,
  authorName,
  open,
  onOpenChange,
  onPostChange,
  onUnavailable,
  restoreFocusTo,
}: Props) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      labelledBy={titleId}
      restoreFocusTo={restoreFocusTo}
      className={styles.dialog}
    >
      <header className={styles.header}>
        <div>
          <span>Cùng chia sẻ và lắng nghe</span>
          <h2 id={titleId}>Bài viết của {authorName}</h2>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Đóng bình luận"
          onClick={() => onOpenChange(false)}
        >
          <X size={21} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.postLink}>
        <span>Một lời đồng cảm cũng có thể tạo nên kết nối.</span>
        <Link href={`/community/${postId}`}>
          Xem toàn bộ bài viết <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.content}>
        <CommunityPostDetail
          postId={postId}
          presentation="dialog"
          onPostChange={onPostChange}
          onUnavailable={onUnavailable}
        />
      </div>
    </Dialog>
  )
}
