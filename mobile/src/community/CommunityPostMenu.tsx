import { useQuery } from '@tanstack/react-query'

import type { CommunityApi } from './community-api'
import type { VersionedPost } from './community-contract'
import { BottomSheet } from './CommunityBottomSheet'
import { SafetyBody, safetyTitle } from './CommunitySafetyActions'
import {
  CommunityButton,
  CommunityMessage,
  communityMessage,
  SkeletonBlock,
  SkeletonGroup,
} from './community-ui'

/**
 * Overflow sheet of a post, for the feed and the detail. Ownership comes from the post detail
 * (an owner has an ETag), so it is read here when the sheet opens; the detail already has it cached.
 */
export function CommunityPostMenu({
  api,
  subject,
  postId,
  value: known,
  open,
  onClose,
  onEdit,
  onHelp,
  onHidden,
  onRefresh,
  onPeerChat,
}: Readonly<{
  api: CommunityApi
  subject: string
  postId: string
  /** The detail screen already holds the post; the feed leaves this out and the sheet loads it. */
  value?: VersionedPost
  open: boolean
  onClose: () => void
  onEdit: (value: VersionedPost) => void
  onHelp: () => void
  onHidden: () => Promise<void>
  onRefresh: () => Promise<void>
  onPeerChat?: ((profileId: string) => void) | undefined
}>) {
  const query = useQuery({
    queryKey: ['community', subject, 'post', postId],
    queryFn: () => api.detail(postId),
    enabled: open && !known,
    staleTime: 30_000,
  })
  const value = known ?? query.data
  const owner = value !== undefined && value.etag !== null
  const author = value?.post.author
  const peerId =
    !owner && author?.state === 'ACTIVE' ? author.communityProfileId : null
  return (
    <BottomSheet
      visible={open}
      onClose={onClose}
      title={safetyTitle('POST', owner)}
    >
      {value ? (
        <SafetyBody
          api={api}
          targetType="POST"
          targetId={postId}
          blockableProfileId={peerId}
          onHidden={onHidden}
          onHelp={onHelp}
          onRefresh={onRefresh}
          onMessageAuthor={
            onPeerChat && peerId ? () => onPeerChat(peerId) : undefined
          }
          owner={
            owner && value.etag !== null
              ? {
                  editable: ['NONE', 'READY'].includes(
                    value.post.mediaAvailability,
                  ),
                  onEdit: () => {
                    onClose()
                    onEdit(value)
                  },
                  onDelete: async () => {
                    await api.remove(postId, value.etag!)
                    await onHidden()
                  },
                }
              : undefined
          }
        />
      ) : query.isError ? (
        <>
          <CommunityMessage>{communityMessage(query.error)}</CommunityMessage>
          <CommunityButton
            variant="quiet"
            label="Thử lại"
            onPress={() => void query.refetch()}
          />
        </>
      ) : (
        <SkeletonGroup label="Đang tải tùy chọn bài viết…">
          <SkeletonBlock height={44} />
          <SkeletonBlock height={44} />
          <SkeletonBlock height={44} />
        </SkeletonGroup>
      )}
    </BottomSheet>
  )
}
