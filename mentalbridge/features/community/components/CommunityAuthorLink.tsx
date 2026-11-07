import Link from 'next/link'
import type { ReactNode } from 'react'
import type { CommunityAuthor } from '@/lib/community/community-validation'
import styles from './CommunitySocial.module.css'

export default function CommunityAuthorLink({
  author,
  children,
}: {
  author: CommunityAuthor
  children?: ReactNode
}) {
  if (author.state !== 'ACTIVE' || !author.communityProfileId)
    return <>{children ?? author.displayName}</>
  return (
    <Link
      className={styles.authorLink}
      href={`/community/members/${author.communityProfileId}`}
    >
      {children ?? author.displayName}
    </Link>
  )
}
