'use client'

import { useState } from 'react'

import { Dialog } from '@/components/ui/Dialog'
import { UUID_PATTERN } from '../api/community-chat-contract'
import type { ChatGroupMember } from '../api/browser-community-chat'
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
}: Readonly<{ groups: Groups; viewerProfileId?: string }>) {
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
        {open
          ? 'Đóng quản lý nhóm'
          : `Thành viên · ${roleName(group.viewerRole)}`}
      </button>
      {open && (
        <div className={styles.groupPanel}>
          <div className={styles.groupPanelHeader}>
            <div>
              <h2>Quản lý thành viên</h2>
              <p>Chỉ thành viên đã chấp thuận mới có thể đọc và gửi tin.</p>
            </div>
          </div>
          {canInvite && (
            <form
              className={styles.inviteForm}
              onSubmit={(event) => {
                event.preventDefault()
                if (!UUID_PATTERN.test(invitee)) return
                void groups.invite(invitee).then((sent) => {
                  if (sent) setInvitee('')
                })
              }}
            >
              <label htmlFor="community-group-invitee">
                Mã hồ sơ cộng đồng của người được mời
              </label>
              <div>
                <input
                  id="community-group-invitee"
                  value={invitee}
                  disabled={groups.busyKey === 'invite'}
                  onChange={(event) => setInvitee(event.target.value.trim())}
                  placeholder="00000000-0000-4000-8000-000000000000"
                />
                <button
                  type="submit"
                  disabled={
                    !UUID_PATTERN.test(invitee) || groups.busyKey === 'invite'
                  }
                >
                  {groups.busyKey === 'invite' ? 'Đang mời…' : 'Mời thành viên'}
                </button>
              </div>
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
              <p>Chủ nhóm phải chuyển quyền hoặc lưu trữ nhóm trước khi rời.</p>
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
