'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { ApiError } from '@/lib/api/api-error'
import {
  archiveChatGroup,
  createChatGroup,
  decideChatGroupInvitation,
  getChatConversation,
  getChatGroupInvitations,
  getChatGroupMembers,
  inviteChatGroupMember,
  removeChatGroupMember,
  setChatGroupMemberRole,
  transferChatGroupOwnership,
  type ChatConversation,
  type ChatGroupInvitation,
  type ChatGroupMember,
} from '../api/browser-community-chat'

function friendlyGroupError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 404)
      return 'Nhóm này không còn khả dụng hoặc bạn không có quyền truy cập.'
    if (error.status === 409)
      return 'Nhóm vừa thay đổi ở nơi khác. Hãy tải lại trước khi thử lại.'
    if (error.status === 429)
      return 'Bạn đang thao tác hơi nhanh. Hãy chờ một chút rồi thử lại.'
    if (error.status === 503 || error.status === 504)
      return 'Kết nối nhóm đang gián đoạn. Bạn có thể thử lại.'
  }
  return 'Chưa thể hoàn tất thao tác nhóm lúc này. Bạn có thể thử lại.'
}

function mergeById<T>(current: T[], incoming: T[], id: (item: T) => string) {
  const ids = new Set(current.map(id))
  return [
    ...current,
    ...incoming.filter((item) => {
      const itemId = id(item)
      if (ids.has(itemId)) return false
      ids.add(itemId)
      return true
    }),
  ]
}

function versionFromEtag(etag: unknown, fallback: string) {
  return typeof etag === 'string' && /^"(0|[1-9]\d{0,18})"$/.test(etag)
    ? etag.slice(1, -1)
    : fallback
}

export function useCommunityGroups({
  conversation,
  viewerProfileId,
  reloadOverview,
  onConversationUpdated,
}: Readonly<{
  conversation?: ChatConversation
  viewerProfileId?: string
  reloadOverview: () => void
  onConversationUpdated: (updated: ChatConversation) => void
}>) {
  const router = useRouter()
  const memberGeneration = useRef(0)
  const group = conversation?.kind === 'GROUP' ? conversation : undefined
  const [invitations, setInvitations] = useState<ChatGroupInvitation[]>([])
  const [invitationCursor, setInvitationCursor] = useState<string | null>(null)
  const [invitationError, setInvitationError] = useState('')
  const [invitationLoading, setInvitationLoading] = useState(true)
  const [members, setMembers] = useState<ChatGroupMember[]>([])
  const [memberCursor, setMemberCursor] = useState<string | null>(null)
  const [memberError, setMemberError] = useState('')
  const [memberLoading, setMemberLoading] = useState(false)
  const [groupVersion, setGroupVersion] = useState(group?.version ?? '')
  const [busyKey, setBusyKey] = useState('')
  const [notice, setNotice] = useState('')

  const loadInvitations = useCallback(async () => {
    setInvitationLoading(true)
    setInvitationError('')
    try {
      const page = await getChatGroupInvitations()
      setInvitations(page.items.filter((item) => item.state === 'PENDING'))
      setInvitationCursor(page.nextCursor)
    } catch (cause) {
      setInvitationError(friendlyGroupError(cause))
    } finally {
      setInvitationLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadInvitations(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadInvitations])

  const loadMembers = useCallback(
    async (generation: number) => {
      if (!group) {
        setMembers([])
        setMemberCursor(null)
        setMemberLoading(false)
        return
      }
      setMemberLoading(true)
      setMemberError('')
      try {
        const page = await getChatGroupMembers(group.conversationId)
        if (memberGeneration.current !== generation) return
        setMembers(page.items)
        setMemberCursor(page.nextCursor)
      } catch (cause) {
        if (memberGeneration.current !== generation) return
        setMembers([])
        setMemberCursor(null)
        setMemberError(friendlyGroupError(cause))
      } finally {
        if (memberGeneration.current === generation) setMemberLoading(false)
      }
    },
    [group],
  )

  useEffect(() => {
    const generation = ++memberGeneration.current
    const timeout = window.setTimeout(() => {
      setGroupVersion(group?.version ?? '')
      void loadMembers(generation)
    }, 0)
    return () => {
      window.clearTimeout(timeout)
      if (memberGeneration.current === generation) memberGeneration.current += 1
    }
  }, [group?.conversationId, group?.version, loadMembers])

  async function loadMoreInvitations() {
    if (!invitationCursor || busyKey === 'invitations-page') return
    setBusyKey('invitations-page')
    setInvitationError('')
    try {
      const page = await getChatGroupInvitations(invitationCursor)
      setInvitations((current) =>
        mergeById(
          current,
          page.items.filter((item) => item.state === 'PENDING'),
          (item) => item.invitationId,
        ),
      )
      setInvitationCursor(page.nextCursor)
    } catch (cause) {
      setInvitationError(friendlyGroupError(cause))
    } finally {
      setBusyKey('')
    }
  }

  async function loadMoreMembers() {
    if (!group || !memberCursor || busyKey === 'members-page') return
    const groupId = group.conversationId
    const generation = memberGeneration.current
    setBusyKey('members-page')
    setMemberError('')
    try {
      const page = await getChatGroupMembers(groupId, memberCursor)
      if (memberGeneration.current !== generation) return
      setMembers((current) =>
        mergeById(current, page.items, (item) =>
          item.peer.state === 'AVAILABLE'
            ? item.peer.communityProfileId
            : `${item.role}:${item.joinedAt}`,
        ),
      )
      setMemberCursor(page.nextCursor)
    } catch (cause) {
      if (memberGeneration.current === generation)
        setMemberError(friendlyGroupError(cause))
    } finally {
      if (memberGeneration.current === generation) setBusyKey('')
    }
  }

  async function create(name: string) {
    setBusyKey('create')
    setNotice('')
    try {
      const created = await createChatGroup(name.trim(), crypto.randomUUID())
      reloadOverview()
      router.push(`/community/messages/${created.conversationId}`)
      return true
    } catch (cause) {
      setNotice(friendlyGroupError(cause))
      return false
    } finally {
      setBusyKey('')
    }
  }

  async function decideInvitation(
    invitation: ChatGroupInvitation,
    decision: 'ACCEPT' | 'DECLINE',
  ) {
    setBusyKey(invitation.invitationId)
    setNotice('')
    try {
      const accepted = await decideChatGroupInvitation(
        invitation.invitationId,
        decision,
        invitation.version,
      )
      setInvitations((current) =>
        current.filter((item) => item.invitationId !== invitation.invitationId),
      )
      reloadOverview()
      if (accepted)
        router.push(`/community/messages/${accepted.conversationId}`)
      else setNotice('Đã từ chối lời mời nhóm.')
    } catch (cause) {
      setNotice(friendlyGroupError(cause))
    } finally {
      setBusyKey('')
    }
  }

  async function invite(communityProfileId: string) {
    if (!group || !groupVersion) return false
    setBusyKey('invite')
    setNotice('')
    try {
      const result = await inviteChatGroupMember(
        group.conversationId,
        communityProfileId,
        groupVersion,
        crypto.randomUUID(),
      )
      setGroupVersion(versionFromEtag(result.version, groupVersion))
      setNotice(
        'Đã gửi lời mời. Người nhận phải tự chấp thuận trước khi tham gia.',
      )
      return true
    } catch (cause) {
      setNotice(friendlyGroupError(cause))
      return false
    } finally {
      setBusyKey('')
    }
  }

  async function setRole(member: ChatGroupMember, role: 'ADMIN' | 'MEMBER') {
    if (!group || member.peer.state !== 'AVAILABLE' || !groupVersion) return
    const memberId = member.peer.communityProfileId
    setBusyKey(memberId)
    setNotice('')
    try {
      const result = await setChatGroupMemberRole(
        group.conversationId,
        memberId,
        role,
        groupVersion,
      )
      setMembers((current) =>
        current.map((item) =>
          item.peer.state === 'AVAILABLE' &&
          item.peer.communityProfileId === memberId
            ? result.member
            : item,
        ),
      )
      setGroupVersion(versionFromEtag(result.version, groupVersion))
      setNotice('Đã cập nhật vai trò thành viên.')
    } catch (cause) {
      setNotice(friendlyGroupError(cause))
    } finally {
      setBusyKey('')
    }
  }

  async function refreshGroupVersion() {
    if (!group) return
    const fresh = await getChatConversation(group.conversationId)
    if (fresh.kind !== 'GROUP') throw new Error('Unexpected conversation kind')
    setGroupVersion(fresh.version)
  }

  async function remove(member: ChatGroupMember) {
    if (!group || member.peer.state !== 'AVAILABLE' || !groupVersion) return
    const memberId = member.peer.communityProfileId
    setBusyKey(memberId)
    setNotice('')
    try {
      await removeChatGroupMember(group.conversationId, memberId, groupVersion)
      if (memberId === viewerProfileId) {
        reloadOverview()
        router.push('/community/messages')
        return
      }
      setMembers((current) =>
        current.filter(
          (item) =>
            item.peer.state !== 'AVAILABLE' ||
            item.peer.communityProfileId !== memberId,
        ),
      )
      await refreshGroupVersion()
      setNotice('Đã xóa thành viên khỏi nhóm.')
    } catch (cause) {
      setNotice(friendlyGroupError(cause))
    } finally {
      setBusyKey('')
    }
  }

  async function transfer(member: ChatGroupMember) {
    if (!group || member.peer.state !== 'AVAILABLE' || !groupVersion) return
    setBusyKey(member.peer.communityProfileId)
    setNotice('')
    try {
      await transferChatGroupOwnership(
        group.conversationId,
        member.peer.communityProfileId,
        groupVersion,
      )
      const updated = await getChatConversation(group.conversationId)
      onConversationUpdated(updated)
      setGroupVersion(updated.version)
      await loadMembers(memberGeneration.current)
      reloadOverview()
      setNotice('Đã chuyển quyền chủ nhóm.')
    } catch (cause) {
      setNotice(friendlyGroupError(cause))
    } finally {
      setBusyKey('')
    }
  }

  async function archive() {
    if (!group || !groupVersion) return false
    setBusyKey('archive')
    setNotice('')
    try {
      await archiveChatGroup(group.conversationId, groupVersion)
      reloadOverview()
      router.push('/community/messages')
      return true
    } catch (cause) {
      setNotice(friendlyGroupError(cause))
      return false
    } finally {
      setBusyKey('')
    }
  }

  return {
    group,
    invitations,
    invitationCursor,
    invitationError,
    invitationLoading,
    members,
    memberCursor,
    memberError,
    memberLoading,
    busyKey,
    notice,
    loadInvitations,
    loadMoreInvitations,
    loadMoreMembers,
    create,
    decideInvitation,
    invite,
    setRole,
    remove,
    transfer,
    archive,
  }
}
