import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'

import { PrimaryButton } from '@/components/PrimaryButton'

import type { CommunityApi } from './community-api'
import { reportReasonSchema, type ReportWrite } from './community-contract'
import {
  CommunityButton,
  CommunityMessage,
  communityStyles as styles,
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

export function CommunitySafetyActions({
  api,
  targetType,
  targetId,
  blockableProfileId,
  onHidden,
  onHelp,
  onRefresh,
}: Readonly<{
  api: CommunityApi
  targetType: 'POST' | 'COMMENT'
  targetId: string
  blockableProfileId: string | null
  onHidden: () => Promise<void>
  onHelp: () => void
  onRefresh: () => Promise<void>
}>) {
  const [open, setOpen] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState<ReportWrite['reason']>('HARASSMENT')
  const [details, setDetails] = useState('')
  const [reported, setReported] = useState(false)
  const [confirmBlock, setConfirmBlock] = useState(false)
  const action = useCommunityAction()
  const key = useCommandKey()
  const targetLabel = targetType === 'POST' ? 'bài viết' : 'bình luận'
  const body: ReportWrite = {
    targetType,
    targetId,
    reason,
    details: details.trim() || null,
  }
  return (
    <View style={styles.column}>
      <CommunityButton
        label={`An toàn cho ${targetLabel}`}
        selected={open}
        onPress={() => setOpen((value) => !value)}
      />
      {open && (
        <View style={styles.card}>
          <CommunityButton
            label={`Báo cáo ${targetLabel}`}
            disabled={action.busy}
            onPress={() => {
              setReporting(true)
              setReported(false)
            }}
          />
          <CommunityButton
            label={`Ẩn ${targetLabel} với tôi`}
            disabled={action.busy}
            onPress={() =>
              void action.run(async () => {
                await api.hide(targetType, targetId)
                await onHidden()
              })
            }
          />
          {blockableProfileId && (
            <CommunityButton
              label="Chặn tác giả"
              disabled={action.busy}
              onPress={() => setConfirmBlock(true)}
            />
          )}
          {confirmBlock && (
            <View style={styles.column}>
              <Text style={styles.body}>
                Chặn tài khoản hiển thị này? Nội dung và tương tác giữa hai bên
                sẽ không còn hiển thị theo quy tắc cộng đồng.
              </Text>
              <CommunityButton
                label="Hủy chặn tác giả"
                onPress={() => setConfirmBlock(false)}
              />
              <CommunityButton
                label="Xác nhận chặn tác giả"
                disabled={action.busy}
                onPress={() =>
                  void action.run(async () => {
                    if (blockableProfileId) {
                      await api.block(blockableProfileId)
                      await onHidden()
                    }
                  })
                }
              />
            </View>
          )}
          {reporting && (
            <View style={styles.column}>
              <Text accessibilityRole="header" style={styles.heading}>
                Lý do báo cáo
              </Text>
              <View style={styles.row}>
                {reportReasonSchema.options.map((value) => (
                  <CommunityButton
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
                  <Text style={styles.muted}>
                    Báo cáo không tự động liên hệ bên thứ ba. Nếu cần, bạn có
                    thể mở danh bạ hỗ trợ ngay.
                  </Text>
                  <CommunityButton label="Mở hỗ trợ ngay" onPress={onHelp} />
                </>
              )}
              <PrimaryButton
                label={action.busy ? 'Đang gửi…' : 'Gửi báo cáo'}
                disabled={action.busy || reported}
                onPress={() =>
                  void action.run(async () => {
                    await api.report(body, key(body))
                    setReported(true)
                    await onRefresh()
                  })
                }
              />
            </View>
          )}
          {reported && (
            <CommunityMessage>
              Báo cáo đã được gửi để đội ngũ quản trị xem xét. Chưa có quyết
              định xử lý nào được giả định.
            </CommunityMessage>
          )}
          {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
        </View>
      )}
    </View>
  )
}
