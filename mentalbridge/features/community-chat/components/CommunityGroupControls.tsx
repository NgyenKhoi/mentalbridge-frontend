'use client'

import { useState } from 'react'
import { Users, X, UserRoundPlus } from 'lucide-react'

import LightSelect from '@/components/LightSelect'
import { Dialog } from '@/components/ui/Dialog'
import type { ChatGroupMember } from '../api/browser-community-chat'
import type { ChatPeer } from '../api/community-chat-contract'
import type { useCommunityGroups } from './useCommunityGroups'
import styles from './CommunityChatWorkspace.module.css'

type Groups = ReturnType<typeof useCommunityGroups>

function memberName(member: ChatGroupMember) {
  return member.peer.state === 'AVAILABLE'
    ? member.peer.displayName
    : 'Thành viên không khả dụng'
}

function roleName(role: ChatGroupMember['role']) {
  if (role === 'OWNER') return 'Chủ nhóm'
  if (role === 'ADMIN') return 'Quản trị viên'
  return 'Thành viên'
}

export function CreateGroupDialog({
  open,
  groups,
  onOpenChange,
}: Readonly<{
  open: boolean
  groups: Groups
  onOpenChange: (open: boolean) => void
}>) {
  const [name, setName] = useState('')
  const valid = name.trim().length >= 1 && [...name.trim()].length <= 80
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (groups.busyKey !== 'create') onOpenChange(next)
      }}
      labelledBy="create-community-group-title"
      describedBy="create-community-group-description"
      className={styles.groupDialog}
    >
      <form
        className={styles.groupForm}
        onSubmit={(event) => {
          event.preventDefault()
          if (!valid) return
          void groups.create(name.trim()).then((created) => {
            if (created) {
              setName('')
              onOpenChange(false)
            }
          })
        }}
      >
        <h2 id="create-community-group-title">Tạo nhóm riêng</h2>
        <p id="create-community-group-description">
          Nhóm chỉ xuất hiện với người được mời. Mỗi người phải tự chấp thuận
          trước khi xem lịch sử hoặc gửi tin.
        </p>
        <label htmlFor="community-group-name">Tên nhóm</label>
        <input
          id="community-group-name"
          value={name}
          maxLength={80}
          disabled={groups.busyKey === 'create'}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
        <small>{[...name].length}/80 ký tự</small>
        <div className={styles.reportActions}>
          <button
            type="button"
            disabled={groups.busyKey === 'create'}
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!valid || groups.busyKey === 'create'}
          >
            {groups.busyKey === 'create' ? 'Đang tạo…' : 'Tạo nhóm'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export function GroupInvitations({ groups }: Readonly<{ groups: Groups }>) {
  if (groups.invitationLoading)
    return (
      <div className={styles.state} role="status" aria-busy="true">
        Đang tải lời mời nhóm…
      </div>
    )
  return (
    <>
      {groups.invitationError && (
        <div className={styles.state} role="alert">
          <p>{groups.invitationError}</p>
          <button type="button" onClick={() => void groups.loadInvitations()}>
            Thử lại
          </button>
        </div>
      )}
      {groups.invitations.length > 0 && (
        <ul className={`${styles.requests} ${styles.groupInvitations}`}>
          {groups.invitations.map((invitation) => (
            <li key={invitation.invitationId}>
              <div className={styles.requestIdentity}>
                <span className={styles.groupAvatar} aria-hidden="true">
                  {invitation.groupName.slice(0, 2).toUpperCase()}
                </span>
                <span>
                  <strong>{invitation.groupName}</strong>
                  <small>
                    Hết hạn{' '}
                    {new Date(invitation.expiresAt).toLocaleDateString('vi-VN')}
                  </small>
                </span>
              </div>
              <p>
                Lời mời từ{' '}
                {invitation.inviter.state === 'AVAILABLE'
                  ? invitation.inviter.displayName
                  : 'thành viên không khả dụng'}
                . Lời mời không tiết lộ lịch sử hoặc danh sách thành viên.
              </p>
              <div className={styles.requestActions}>
                <button
                  type="button"
                  disabled={groups.busyKey === invitation.invitationId}
                  onClick={() =>
                    void groups.decideInvitation(invitation, 'ACCEPT')
                  }
                >
                  Tham gia
                </button>
                <button
                  type="button"
                  disabled={groups.busyKey === invitation.invitationId}
                  onClick={() =>
                    void groups.decideInvitation(invitation, 'DECLINE')
                  }
                >
                  Từ chối
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(groups.invitationCursor || groups.invitationError) && (
        <div className={styles.pageActions}>
          <button
            type="button"
            disabled={groups.busyKey === 'invitations-page'}
            onClick={() =>
              void (groups.invitationError
                ? groups.loadInvitations()
                : groups.loadMoreInvitations())
            }
          >
            {groups.busyKey === 'invitations-page'
              ? 'Đang tải…'
              : groups.invitationError
                ? 'Thử lại'
                : 'Tải thêm lời mời nhóm'}
          </button>
        </div>
      )}
    </>
  )
}

export function GroupManagement({
  groups,
  viewerProfileId,
  inviteCandidates,
  onLoadMoreCandidates,
  loadingCandidates = false,
  candidateError,
  onRetryCandidates,
}: Readonly<{
  groups: Groups
  viewerProfileId?: string
  inviteCandidates: ChatPeer[]
  onLoadMoreCandidates?: () => void
  loadingCandidates?: boolean
  candidateError?: string
  onRetryCandidates?: () => void
}>) {
  const [open, setOpen] = useState(false)
  const [invitee, setInvitee] = useState('')
  const [confirm, setConfirm] = useState<
    | { type: 'remove'; member: ChatGroupMember }
    | { type: 'transfer'; member: ChatGroupMember }
    | { type: 'archive' }
  >()
  const group = groups.group
  if (!group) return null
  const canManage = group.viewerRole === 'OWNER' || group.viewerRole === 'ADMIN'
  const canInvite = canManage && group.state === 'ACTIVE'
  const memberIds = new Set(
    [...group.peers, ...groups.members.map((member) => member.peer)].flatMap(
      (member) =>
        member.state === 'AVAILABLE' ? [member.communityProfileId] : [],
    ),
  )
  const eligibleInvitees = inviteCandidates.filter(
    (candidate): candidate is Extract<ChatPeer, { state: 'AVAILABLE' }> =>
      candidate.state === 'AVAILABLE' &&
      candidate.communityProfileId !== viewerProfileId &&
      !memberIds.has(candidate.communityProfileId),
  )
  const inviteOptions = eligibleInvitees.map((candidate) => ({
    value: candidate.communityProfileId,
    label: candidate.displayName,
  }))
  const selectedInvitee = inviteOptions.some(
    (option) => option.value === invitee,
  )
    ? invitee
    : ''

  async function confirmAction() {
    if (!confirm) return
    if (confirm.type === 'archive') await groups.archive()
    else if (confirm.type === 'transfer') await groups.transfer(confirm.member)
    else await groups.remove(confirm.member)
    setConfirm(undefined)
  }

  return (
    <section className={styles.groupManagement} aria-label="Quản lý nhóm riêng">
      <button
        type="button"
        className={styles.manageGroupButton}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? (
          <>
            <Users size={16} />
            Thông tin nhóm
          </>
        ) : (
          <>
            <Users size={16} />
            {group.peers.length} thành viên <span>·</span>{' '}
            {roleName(group.viewerRole)}
          </>
        )}
      </button>
      {open && (
        <Dialog
          open={open}
          onOpenChange={setOpen}
          labelledBy="community-group-info-title"
          className={styles.groupDetailsDialog}
        >
          <div className={styles.groupPanel}>
            <div className={styles.groupPanelHeader}>
              <div>
                <span className={styles.groupInfoIcon}>
                  <Users size={28} />
                </span>
                <h2 id="community-group-info-title">{group.groupName}</h2>
                <p>Nhóm chat riêng · {group.peers.length} thành viên</p>
              </div>
              <button
                type="button"
                aria-label="Đóng thông tin nhóm"
                onClick={() => setOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            {canInvite && (
              <form
                className={styles.inviteForm}
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!selectedInvitee) return
                  void groups.invite(selectedInvitee).then((sent) => {
                    if (sent) setInvitee('')
                  })
                }}
              >
                <label id="community-group-invitee-label">
                  <UserRoundPlus size={16} /> Mời thêm bạn bè
                </label>
                <p className={styles.inviteHint}>
                  Người được mời phải là bạn bè đã chấp nhận và tự đồng ý tham
                  gia nhóm.
                </p>
                {inviteOptions.length ? (
                  <div>
                    <LightSelect
                      id="community-group-invitee"
                      value={selectedInvitee}
                      labelledBy="community-group-invitee-label"
                      placeholder="Chọn người để mời"
                      options={inviteOptions}
                      disabled={groups.busyKey === 'invite'}
                      onChange={setInvitee}
                    />
                    <button
                      type="submit"
                      disabled={!selectedInvitee || groups.busyKey === 'invite'}
                    >
                      {groups.busyKey === 'invite'
                        ? 'Đang mời…'
                        : 'Mời thành viên'}
                    </button>
                  </div>
                ) : (
                  <p className={styles.inviteEmpty}>
                    {loadingCandidates
                      ? 'Đang tải bạn bè…'
                      : 'Chưa có bạn bè phù hợp để mời. Bạn có thể kết bạn từ trang cá nhân cộng đồng.'}
                  </p>
                )}
                {candidateError && (
                  <p role="alert">
                    {candidateError}{' '}
                    <button type="button" onClick={onRetryCandidates}>
                      Thử lại
                    </button>
                  </p>
                )}
                {onLoadMoreCandidates && (
                  <button
                    type="button"
                    disabled={loadingCandidates}
                    onClick={onLoadMoreCandidates}
                  >
                    {loadingCandidates ? 'Đang tải…' : 'Xem thêm bạn bè'}
                  </button>
                )}
              </form>
            )}
            {groups.memberLoading ? (
              <p role="status" aria-busy="true">
                Đang tải thành viên…
              </p>
            ) : groups.memberError ? (
              <p role="alert">{groups.memberError}</p>
            ) : (
              <ul className={styles.memberList}>
                {groups.members.map((member, index) => {
                  const memberId =
                    member.peer.state === 'AVAILABLE'
                      ? member.peer.communityProfileId
                      : ''
                  const self = memberId === viewerProfileId
                  const ownerCanChange =
                    group.viewerRole === 'OWNER' &&
                    member.role !== 'OWNER' &&
                    !self
                  const adminCanRemove =
                    group.viewerRole === 'ADMIN' &&
                    member.role === 'MEMBER' &&
                    !self
                  const canRemove =
                    ownerCanChange ||
                    adminCanRemove ||
                    (self && group.viewerRole !== 'OWNER')
                  return (
                    <li
                      key={
                        memberId || `${member.role}-${member.joinedAt}-${index}`
                      }
                    >
                      <div>
                        <strong>
                          {memberName(member)}
                          {self ? ' · Bạn' : ''}
                        </strong>
                        <small>{roleName(member.role)}</small>
                      </div>
                      {member.peer.state === 'AVAILABLE' && (
                        <div className={styles.memberActions}>
                          {ownerCanChange && (
                            <button
                              type="button"
                              disabled={groups.busyKey === memberId}
                              onClick={() =>
                                void groups.setRole(
                                  member,
                                  member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
                                )
                              }
                            >
                              {member.role === 'ADMIN'
                                ? 'Hạ quyền'
                                : 'Thăng cấp quản trị'}
                            </button>
                          )}
                          {group.viewerRole === 'OWNER' &&
                            member.role === 'ADMIN' &&
                            !self && (
                              <button
                                type="button"
                                disabled={groups.busyKey === memberId}
                                onClick={() =>
                                  setConfirm({ type: 'transfer', member })
                                }
                              >
                                Chuyển quyền chủ nhóm
                              </button>
                            )}
                          {canRemove && (
                            <button
                              className={styles.dangerButton}
                              type="button"
                              disabled={groups.busyKey === memberId}
                              onClick={() =>
                                setConfirm({ type: 'remove', member })
                              }
                            >
                              {self ? 'Rời nhóm' : 'Xóa khỏi nhóm'}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {groups.memberCursor && (
              <button
                type="button"
                disabled={groups.busyKey === 'members-page'}
                onClick={() => void groups.loadMoreMembers()}
              >
                {groups.busyKey === 'members-page'
                  ? 'Đang tải…'
                  : 'Tải thêm thành viên'}
              </button>
            )}
            {group.viewerRole === 'OWNER' && group.state === 'ACTIVE' && (
              <div className={styles.groupDangerZone}>
                <p>
                  Chủ nhóm phải chuyển quyền hoặc lưu trữ nhóm trước khi rời.
                </p>
                <button
                  className={styles.dangerButton}
                  type="button"
                  disabled={groups.busyKey === 'archive'}
                  onClick={() => setConfirm({ type: 'archive' })}
                >
                  Lưu trữ nhóm
                </button>
              </div>
            )}
          </div>
        </Dialog>
      )}
      <Dialog
        open={Boolean(confirm)}
        onOpenChange={(next) => {
          if (!next && !groups.busyKey) setConfirm(undefined)
        }}
        labelledBy="community-group-confirm-title"
        describedBy="community-group-confirm-description"
        className={styles.groupDialog}
      >
        <div className={styles.groupForm}>
          <h2 id="community-group-confirm-title">Xác nhận thay đổi nhóm</h2>
          <p id="community-group-confirm-description">
            {confirm?.type === 'archive'
              ? 'Nhóm sẽ chuyển sang chỉ đọc và các lời mời đang chờ sẽ bị thu hồi.'
              : confirm?.type === 'transfer'
                ? 'Người được chọn sẽ trở thành chủ nhóm. Bạn sẽ trở thành quản trị viên.'
                : confirm?.member.peer.state === 'AVAILABLE' &&
                    confirm.member.peer.communityProfileId === viewerProfileId
                  ? 'Bạn sẽ mất quyền xem lịch sử, thành viên và tin nhắn của nhóm ngay lập tức.'
                  : 'Thành viên sẽ mất quyền xem lịch sử, thành viên và tin nhắn của nhóm ngay lập tức.'}
          </p>
          <div className={styles.reportActions}>
            <button
              type="button"
              disabled={Boolean(groups.busyKey)}
              onClick={() => setConfirm(undefined)}
            >
              Quay lại
            </button>
            <button
              className={styles.dangerButton}
              type="button"
              disabled={Boolean(groups.busyKey)}
              onClick={() => void confirmAction()}
            >
              Xác nhận
            </button>
          </div>
        </div>
      </Dialog>
    </section>
  )
}
