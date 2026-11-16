import { useState, type ComponentProps } from 'react'
import { TextInput, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { Txt } from '@/theme/dashboard'

import type { CommunityApi } from './community-api'
import { reportReasonSchema, type ReportWrite } from './community-contract'
import { BottomSheet } from './CommunityBottomSheet'
import {
  ActionRow,
  ChoiceRow,
  CommunityButton,
  CommunityMessage,
  communityStyles as styles,
  communityText,
  useCommandKey,
  useCommunityAction,
} from './community-ui'

const reasonLabels: Record<ReportWrite['reason'], string> = {
  HARASSMENT: 'Quấy rối hoặc công kích',
  PRIVACY_OR_DOXXING: 'Tiết lộ thông tin riêng tư',
  MEDICAL_MISINFORMATION: 'Thông tin y tế sai lệch',
  SELF_HARM_OR_CRISIS_CONCERN: 'Lo ngại người đăng cần hỗ trợ ngay',
  SPAM: 'Spam hoặc quảng cáo',
  SEXUAL_OR_VIOLENT_CONTENT: 'Nội dung tình dục hoặc bạo lực',
  OTHER: 'Lý do khác',
}

type Step = 'menu' | 'report' | 'block' | 'delete'

/** Owner actions for a post: edit, and delete behind its own confirm step. */
export type OwnerActions = Readonly<{
  editable: boolean
  onEdit: () => void
  onDelete: () => Promise<void>
}>

/** Menu, report, block and delete steps; renders inside a BottomSheet and starts at the menu each time the sheet opens. */
export function SafetyBody({
  api,
  targetType,
  targetId,
  blockableProfileId,
  onHidden,
  onHelp,
  onRefresh,
  onMessageAuthor,
  owner,
}: Readonly<{
  api: CommunityApi
  targetType: 'POST' | 'COMMENT'
  targetId: string
  blockableProfileId: string | null
  onHidden: () => Promise<void>
  onHelp: () => void
  onRefresh: () => Promise<void>
  onMessageAuthor?: (() => void) | undefined
  owner?: OwnerActions | undefined
}>) {
  const [step, setStep] = useState<Step>('menu')
  const [reason, setReason] = useState<ReportWrite['reason']>('HARASSMENT')
  const [details, setDetails] = useState('')
  const [reported, setReported] = useState(false)
  const action = useCommunityAction()
  const execute = (command: () => Promise<void>) =>
    action.run(async () => {
      try {
        await command()
      } catch (error) {
        if (
          error instanceof ApiError &&
          [401, 403, 404].includes(error.status ?? 0)
        )
          await onHidden()
        throw error
      }
    })
  const key = useCommandKey()
  const targetLabel = targetType === 'POST' ? 'bài viết' : 'bình luận'
  const body: ReportWrite = {
    targetType,
    targetId,
    reason,
    details: details.trim() || null,
  }
  const toMenu = (
    <CommunityButton
      variant="quiet"
      label="Quay lại"
      onPress={() => setStep('menu')}
    />
  )
  return (
    <>
      {step === 'menu' && (
        <View>
          {owner && (
            <>
              <ActionRow
                icon="pencil-outline"
                label="Sửa bài viết của tôi"
                disabled={action.busy || !owner.editable}
                onPress={owner.onEdit}
              />
              {!owner.editable && (
                <CommunityMessage>
                  Tải lại media trước khi sửa để không vô tình bỏ tệp chưa hiển
                  thị.
                </CommunityMessage>
              )}
              <ActionRow
                icon="trash-can-outline"
                danger
                label="Xóa bài viết của tôi"
                disabled={action.busy}
                onPress={() => setStep('delete')}
              />
            </>
          )}
          {onMessageAuthor && (
            <ActionRow
              icon="message-text-outline"
              label="Trò chuyện với tác giả"
              disabled={action.busy}
              onPress={onMessageAuthor}
            />
          )}
          <ActionRow
            icon="flag-outline"
            label={`Báo cáo ${targetLabel}`}
            disabled={action.busy}
            onPress={() => {
              setStep('report')
              setReported(false)
            }}
          />
          <ActionRow
            icon="eye-off-outline"
            label={`Ẩn ${targetLabel} với tôi`}
            disabled={action.busy}
            onPress={() =>
              void execute(async () => {
                await api.hide(targetType, targetId)
                await onHidden()
              })
            }
          />
          {blockableProfileId && (
            <ActionRow
              icon="account-cancel-outline"
              label="Chặn tác giả"
              danger
              disabled={action.busy}
              onPress={() => setStep('block')}
            />
          )}
        </View>
      )}
      {step === 'delete' && owner && (
        <View style={styles.column}>
          <Txt style={communityText.body}>
            Xóa chia sẻ này? Bài sẽ không còn hiển thị trong cộng đồng.
          </Txt>
          <CommunityButton
            variant="quiet"
            label="Giữ bài viết"
            onPress={() => setStep('menu')}
          />
          <CommunityButton
            variant="primary"
            label="Xác nhận xóa bài viết"
            disabled={action.busy}
            onPress={() => void action.run(owner.onDelete)}
          />
        </View>
      )}
      {step === 'block' && (
        <View style={styles.column}>
          <Txt style={communityText.body}>
            Chặn tài khoản hiển thị này? Nội dung và tương tác giữa hai bên sẽ
            không còn hiển thị theo quy tắc cộng đồng.
          </Txt>
          <CommunityButton
            variant="quiet"
            label="Hủy chặn tác giả"
            onPress={() => setStep('menu')}
          />
          <CommunityButton
            variant="primary"
            label="Xác nhận chặn tác giả"
            disabled={action.busy}
            onPress={() =>
              void execute(async () => {
                if (blockableProfileId) {
                  await api.block(blockableProfileId)
                  await onHidden()
                }
              })
            }
          />
        </View>
      )}
      {step === 'report' && (
        <View style={styles.column}>
          <Txt accessibilityRole="header" style={communityText.section}>
            Lý do báo cáo
          </Txt>
          <View accessibilityRole="radiogroup">
            {reportReasonSchema.options.map((value) => (
              <ChoiceRow
                key={value}
                label={reasonLabels[value]}
                selected={reason === value}
                disabled={action.busy || reported}
                onPress={() => setReason(value)}
              />
            ))}
          </View>
          <TextInput
            accessibilityLabel="Chi tiết báo cáo (không bắt buộc)"
            multiline
            maxLength={1000}
            value={details}
            style={styles.input}
            editable={!action.busy && !reported}
            onChangeText={setDetails}
          />
          {reason === 'SELF_HARM_OR_CRISIS_CONCERN' && (
            <>
              <Txt style={communityText.meta}>
                Báo cáo không tự động liên hệ bên thứ ba. Nếu cần, bạn có thể mở
                danh bạ hỗ trợ ngay.
              </Txt>
              <CommunityButton
                variant="quiet"
                label="Mở hỗ trợ ngay"
                onPress={onHelp}
              />
            </>
          )}
          <CommunityButton
            variant="primary"
            label={action.busy ? 'Đang gửi…' : 'Gửi báo cáo'}
            disabled={action.busy || reported}
            onPress={() =>
              void execute(async () => {
                await api.report(body, key(body))
                setReported(true)
                setStep('menu')
                await onRefresh()
              })
            }
          />
          {toMenu}
        </View>
      )}
      {reported && step === 'menu' && (
        <CommunityMessage>
          Báo cáo đã được gửi để đội ngũ quản trị xem xét. Chưa có quyết định xử
          lý nào được giả định.
        </CommunityMessage>
      )}
      {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
    </>
  )
}

export const safetyTitle = (targetType: 'POST' | 'COMMENT', owner: boolean) =>
  owner
    ? 'Tùy chọn bài viết'
    : `An toàn cho ${targetType === 'POST' ? 'bài viết' : 'bình luận'}`

/** Safety sheet for a comment (and any target whose ownership is already known). `open` and the trigger belong to the caller. */
export function CommunitySafetyActions({
  open,
  onClose,
  ...body
}: ComponentProps<typeof SafetyBody> &
  Readonly<{ open: boolean; onClose: () => void }>) {
  return (
    <BottomSheet
      visible={open}
      onClose={onClose}
      title={safetyTitle(body.targetType, Boolean(body.owner))}
    >
      <SafetyBody {...body} />
    </BottomSheet>
  )
}
