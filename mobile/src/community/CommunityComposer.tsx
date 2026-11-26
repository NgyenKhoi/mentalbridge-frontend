import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import {
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ApiError } from '@/api/api-error'
import { PrimaryButton } from '@/components/PrimaryButton'
import type { ResourceApi } from '@/resources/resource-api'
import { colors, radii, spacing } from '@/theme/tokens'

import type { CommunityApi } from './community-api'
import {
  postWriteSchema,
  type CommunityTopicCode,
  type VersionedPost,
} from './community-contract'
import type { CommunityMediaTransport } from './community-media'
import { CommunityMediaEditor } from './CommunityMedia'
import {
  CommunityButton,
  CommunityMessage,
  communityMessage,
  useCommandKey,
  useCommunityAction,
} from './community-ui'

export function CommunityComposer({
  api,
  resources,
  subject,
  initial,
  transport,
  onCancel,
  onSaved,
  initialContent = '',
  initialMode = 'PROFILE',
}: Readonly<{
  api: CommunityApi
  resources: ResourceApi
  subject: string
  initial: VersionedPost | null
  transport: CommunityMediaTransport
  onCancel: () => void
  onSaved: (value: VersionedPost) => void | Promise<void>
  initialContent?: string
  initialMode?: 'PROFILE' | 'ANONYMOUS'
}>) {
  const [content, setContent] = useState(
    initial?.post.content ?? initialContent,
  )
  const [topics, setTopics] = useState<CommunityTopicCode[]>(
    initial?.post.topics ?? [],
  )
  const [mode, setMode] = useState<'PROFILE' | 'ANONYMOUS'>(
    initial
      ? initial.post.author.state === 'ANONYMOUS'
        ? 'ANONYMOUS'
        : 'PROFILE'
      : initialMode,
  )
  const [warning, setWarning] = useState(
    initial?.post.sensitiveContentWarning === 'SENSITIVE_CONTENT',
  )
  const [resourceId, setResourceId] = useState<string | null>(
    initial?.post.resourceAttachment?.resourceId ?? null,
  )
  const [showResources, setShowResources] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [mediaIds, setMediaIds] = useState(
    initial?.post.media.map((media) => media.mediaId) ?? [],
  )
  const [mediaBusy, setMediaBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [stale, setStale] = useState(false)
  const action = useCommunityAction()
  const commandKey = useCommandKey()
  const topicQuery = useQuery({
    queryKey: ['community', subject, 'topics'],
    queryFn: () => api.topics(),
  })
  const profile = useQuery({
    queryKey: ['community', subject, 'profile'],
    queryFn: () => api.profile(),
    retry: false,
    refetchOnMount: 'always',
  })
  const resourceQuery = useInfiniteQuery({
    queryKey: ['community-resource-options', subject],
    enabled: showResources,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      resources.listResources({
        locale: 'vi-VN',
        limit: 20,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (page) => page.nextCursor,
  })
  const requestCancel = useCallback(() => {
    if (action.busy) return
    if (
      !content.trim() &&
      !topics.length &&
      !mediaIds.length &&
      !resourceId &&
      !initial
    )
      onCancel()
    else setConfirmCancel(true)
  }, [
    action.busy,
    content,
    topics.length,
    mediaIds.length,
    resourceId,
    initial,
    onCancel,
  ])
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        requestCancel()
        return true
      },
    )
    return () => subscription.remove()
  }, [requestCancel])
  const mediaChange = useCallback((ids: string[], busy: boolean) => {
    setMediaIds(ids)
    setMediaBusy(busy)
  }, [])
  const disabled = action.busy || unconfirmed || stale
  const body = {
    content: content.trim(),
    topics,
    mediaIds,
    authorMode: mode,
    resourceId,
    sensitiveContentWarning: warning ? ('SENSITIVE_CONTENT' as const) : null,
  }
  const valid =
    postWriteSchema.safeParse(body).success &&
    topics.every((code) =>
      topicQuery.data?.some((topic) => topic.code === code),
    )
  const save = () =>
    action.run(async () => {
      try {
        const value = initial
          ? await api.update(initial.post.postId, initial.etag!, body)
          : await api.create(body, commandKey(body))
        await onSaved(value)
      } catch (error) {
        if (error instanceof ApiError && error.status === 412) setStale(true)
        else if (
          !(error instanceof ApiError) ||
          error.status == null ||
          error.status >= 500
        )
          setUnconfirmed(true)
        throw error
      }
    })
  const saveLabel = action.busy
    ? 'Đang gửi…'
    : unconfirmed
      ? 'Thử lại cùng yêu cầu'
      : initial
        ? 'Lưu thay đổi'
        : 'Đăng bài viết'
  const cannotSave =
    !valid ||
    mediaBusy ||
    action.busy ||
    stale ||
    (initial !== null && initial.etag === null)

  return (
    <Modal
      transparent
      visible
      animationType="slide"
      statusBarTranslucent
      onRequestClose={requestCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.modal}
      >
        <Pressable
          accessible={false}
          style={StyleSheet.absoluteFill}
          onPress={requestCancel}
        />
        <SafeAreaView
          edges={['bottom']}
          style={s.sheet}
          accessibilityViewIsModal
        >
          <View aria-hidden style={s.handle} />
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Text aria-hidden style={s.green}>
                ✧
              </Text>
            </View>
            <View style={s.flex}>
              <Text accessibilityRole="header" style={s.title}>
                {initial ? 'Sửa bài viết sẻ chia' : 'Tạo bài viết sẻ chia'}
              </Text>
              <Text style={s.subtitle}>Không gian an toàn &amp; sẻ chia</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại cộng đồng"
              disabled={action.busy}
              onPress={requestCancel}
              style={s.close}
            >
              <Text aria-hidden style={s.closeText}>
                ×
              </Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            <View style={s.identityBox}>
              <Text style={s.eyebrow}>♧ DANH TÍNH XUẤT HIỆN</Text>
              <View style={s.identityRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ẩn danh"
                  accessibilityState={{
                    selected: mode === 'ANONYMOUS',
                    disabled,
                  }}
                  disabled={disabled}
                  onPress={() => setMode('ANONYMOUS')}
                  style={[
                    s.identity,
                    mode === 'ANONYMOUS' && s.selectedIdentity,
                  ]}
                >
                  <View style={s.identityIcon}>
                    <Text aria-hidden>♧</Text>
                  </View>
                  <View style={s.flex}>
                    <Text style={s.identityTitle}>Ẩn danh an toàn</Text>
                    <Text style={s.small}>Bảo vệ danh tính</Text>
                  </View>
                  <Text aria-hidden style={s.green}>
                    {mode === 'ANONYMOUS' ? '●' : '○'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tên cộng đồng"
                  accessibilityState={{
                    selected: mode === 'PROFILE',
                    disabled,
                  }}
                  disabled={disabled}
                  onPress={() => setMode('PROFILE')}
                  style={[s.identity, mode === 'PROFILE' && s.selectedIdentity]}
                >
                  <View style={s.identityIcon}>
                    <Text style={s.small}>Tôi</Text>
                  </View>
                  <View style={s.flex}>
                    <Text style={s.identityTitle}>
                      {profile.isSuccess && profile.data
                        ? profile.data.profile.displayName
                        : 'Tên cộng đồng'}
                    </Text>
                    <Text style={s.small}>Công khai hồ sơ</Text>
                  </View>
                  <Text aria-hidden style={s.green}>
                    {mode === 'PROFILE' ? '●' : '○'}
                  </Text>
                </Pressable>
              </View>
              {profile.isError && mode === 'PROFILE' && (
                <CommunityButton
                  label="Tải lại danh tính cộng đồng"
                  onPress={() => void profile.refetch()}
                />
              )}
            </View>
            <View style={s.section}>
              <View style={s.row}>
                <Text accessibilityRole="header" style={[s.eyebrow, s.flex]}>
                  CHỦ ĐỀ &amp; CẢM XÚC
                </Text>
                <Text style={s.small}>Chọn 1–3 chủ đề</Text>
              </View>
              {topicQuery.isPending && (
                <CommunityMessage>Đang tải chủ đề…</CommunityMessage>
              )}
              {topicQuery.isError && (
                <CommunityButton
                  label="Tải lại chủ đề"
                  onPress={() => void topicQuery.refetch()}
                />
              )}
              {topicQuery.isSuccess && !topicQuery.data.length && (
                <CommunityMessage>
                  Chưa có chủ đề đang mở để đăng bài.
                </CommunityMessage>
              )}
              <View style={s.topics}>
                {topicQuery.data?.map((topic) => (
                  <Pressable
                    key={topic.code}
                    accessibilityRole="button"
                    accessibilityLabel={topic.label}
                    accessibilityState={{
                      selected: topics.includes(topic.code),
                      disabled:
                        disabled ||
                        (!topics.includes(topic.code) && topics.length >= 3),
                    }}
                    disabled={
                      disabled ||
                      (!topics.includes(topic.code) && topics.length >= 3)
                    }
                    onPress={() =>
                      setTopics((selected) =>
                        selected.includes(topic.code)
                          ? selected.filter((code) => code !== topic.code)
                          : [...selected, topic.code],
                      )
                    }
                    style={[
                      s.topic,
                      topics.includes(topic.code) && s.selectedTopic,
                    ]}
                  >
                    <Text style={s.topicText}># {topic.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={s.writingBox}>
              <TextInput
                accessibilityLabel="Nội dung chia sẻ"
                testID="community-post-content"
                multiline
                maxLength={5000}
                style={s.input}
                placeholder="Hãy viết ra để nhẹ lòng hơn… Không gian này luôn lắng nghe và không phán xét bạn."
                placeholderTextColor={colors.inkFaint}
                editable={!disabled}
                value={content}
                onChangeText={setContent}
              />
              <View style={s.writingFooter}>
                <Text style={s.smallGreen}>♥ Nơi bạn tự do là chính mình</Text>
                <Text style={s.small}>{[...content].length}/5.000</Text>
              </View>
            </View>
            <View style={s.attachments}>
              <Text accessibilityRole="header" style={s.eyebrow}>
                ĐÍNH KÈM THÊM
              </Text>
              <CommunityMediaEditor
                api={api}
                transport={transport}
                initialMedia={initial?.post.media ?? []}
                disabled={disabled}
                onChange={mediaChange}
                compact
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tùy chọn bài viết"
                accessibilityState={{ expanded: showOptions }}
                onPress={() => setShowOptions((value) => !value)}
                style={s.optionToggle}
              >
                <Text style={s.optionText}>
                  Liên kết tài nguyên &amp; cảnh báo nội dung
                </Text>
                <Text aria-hidden style={s.green}>
                  {showOptions ? '⌃' : '⌄'}
                </Text>
              </Pressable>
              {resourceId && !showOptions && (
                <Text style={s.smallGreen}>Đã kèm liên kết tài nguyên</Text>
              )}
              {showOptions && (
                <View style={s.section}>
                  <CommunityButton
                    label="Cảnh báo nội dung nhạy cảm"
                    selected={warning}
                    disabled={disabled}
                    onPress={() => setWarning((value) => !value)}
                  />
                  <Text style={s.small}>
                    Ẩn danh không hiện liên kết hồ sơ trên bài viết. Bình luận
                    vẫn hiển thị tên cộng đồng.
                  </Text>
                  {resourceId && (
                    <CommunityButton
                      label="Gỡ liên kết tài nguyên"
                      disabled={disabled}
                      onPress={() => setResourceId(null)}
                    />
                  )}
                  <CommunityButton
                    label={
                      showResources
                        ? 'Đóng danh sách tài nguyên'
                        : 'Chọn tài nguyên đã rà soát'
                    }
                    disabled={disabled}
                    onPress={() => setShowResources((value) => !value)}
                  />
                  {showResources && (
                    <View style={s.section}>
                      {resourceQuery.isPending && (
                        <CommunityMessage>
                          Đang tải tài nguyên…
                        </CommunityMessage>
                      )}
                      {resourceQuery.isError && (
                        <CommunityMessage>
                          {communityMessage(resourceQuery.error)}
                        </CommunityMessage>
                      )}
                      {!resourceQuery.isError &&
                        resourceQuery.data?.pages.map((page, index) => (
                          <View key={index} style={s.section}>
                            {page.fallback === 'unavailable' ? (
                              <CommunityMessage>
                                Danh sách tài nguyên chưa sẵn sàng. Bạn vẫn có
                                thể đăng chia sẻ không kèm liên kết.
                              </CommunityMessage>
                            ) : (
                              page.data.map((resource) => (
                                <CommunityButton
                                  key={resource.id}
                                  label={resource.title}
                                  disabled={disabled}
                                  selected={resourceId === resource.id}
                                  onPress={() => {
                                    setResourceId(resource.id)
                                    setShowResources(false)
                                  }}
                                />
                              ))
                            )}
                          </View>
                        ))}
                      {resourceQuery.hasNextPage && (
                        <CommunityButton
                          label="Tải thêm tài nguyên"
                          disabled={resourceQuery.isFetchingNextPage}
                          onPress={() => void resourceQuery.fetchNextPage()}
                        />
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
            <View style={s.culture}>
              <Text aria-hidden style={s.green}>
                ♧
              </Text>
              <Text style={s.cultureText}>
                <Text style={s.bold}>Văn hóa MentalBridge: </Text>Tôn trọng,
                lắng nghe và không phán xét bất kỳ ai.
              </Text>
            </View>
            {action.error && (
              <CommunityMessage>{action.error}</CommunityMessage>
            )}
            {unconfirmed && (
              <CommunityMessage>
                Giữ nguyên bản nháp để thử lại cùng yêu cầu. Bạn chưa có xác
                nhận bài đã được lưu.
              </CommunityMessage>
            )}
            {stale && (
              <CommunityMessage>
                Quay lại và tải bản mới. Không tự ghi đè thay đổi trên máy chủ.
              </CommunityMessage>
            )}
          </ScrollView>
          {confirmCancel && (
            <View style={s.cancelConfirmation} accessibilityLiveRegion="polite">
              <Text style={s.identityTitle}>Bạn muốn bỏ bản nháp này?</Text>
              <Text style={s.small}>Nội dung đang viết sẽ được đóng.</Text>
              {unconfirmed && (
                <CommunityMessage>
                  Yêu cầu trước chưa được xác nhận. Tải lại cộng đồng để kiểm
                  tra trước khi tạo một bài khác.
                </CommunityMessage>
              )}
              <CommunityButton
                label="Tiếp tục chỉnh sửa"
                onPress={() => setConfirmCancel(false)}
              />
              <CommunityButton label="Bỏ bản nháp" onPress={onCancel} />
            </View>
          )}
          <View style={s.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hủy bài viết"
              disabled={action.busy}
              onPress={requestCancel}
              style={s.cancelButton}
            >
              <Text style={s.optionText}>Hủy</Text>
            </Pressable>
            <View style={s.saveButton}>
              <PrimaryButton
                testID="community-post-save"
                label={saveLabel}
                accessibilityLabel={
                  !initial && !action.busy && !unconfirmed
                    ? 'Đăng chia sẻ'
                    : saveLabel
                }
                leadingIcon="➤"
                tone="dashboard"
                disabled={cannotSave}
                onPress={() => void save()}
              />
            </View>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(12, 28, 23, 0.45)',
  },
  sheet: {
    maxHeight: '94%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  handle: {
    width: 38,
    height: 4,
    backgroundColor: '#D8DBD7',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  headerIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EFF5F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  subtitle: { color: colors.tealDeep, fontSize: 11, marginTop: 2 },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    width: 30,
    lineHeight: 30,
    textAlign: 'center',
    borderRadius: 15,
    backgroundColor: '#F2F4F1',
    color: colors.inkSoft,
    fontSize: 24,
    overflow: 'hidden',
  },
  content: { padding: spacing.lg, gap: spacing.lg },
  identityBox: {
    padding: spacing.sm,
    gap: spacing.sm,
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#F8FAF8',
  },
  identityRow: { flexDirection: 'row', gap: spacing.sm },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 68,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
  },
  selectedIdentity: { borderColor: '#43836C', backgroundColor: '#F2FAF5' },
  identityTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  identityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E9F0EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  green: { color: colors.tealDeep, fontSize: 18 },
  small: { color: colors.inkSoft, fontSize: 10, lineHeight: 15 },
  smallGreen: { color: colors.tealDeep, fontSize: 10, lineHeight: 16 },
  eyebrow: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  section: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  topic: {
    minHeight: 36,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  selectedTopic: { borderColor: '#B8DACE', backgroundColor: '#EAF5EF' },
  topicText: { color: colors.ink, fontSize: 11 },
  writingBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.panel,
    backgroundColor: '#FAFBF9',
  },
  input: {
    minHeight: 142,
    padding: spacing.md,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  writingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  attachments: {
    gap: spacing.sm,
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  optionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 44,
  },
  optionText: {
    color: colors.tealDeep,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  culture: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.control,
    backgroundColor: '#F2F8F4',
    padding: spacing.md,
  },
  cultureText: {
    color: colors.tealDeep,
    fontSize: 11,
    lineHeight: 18,
    flex: 1,
  },
  bold: { fontWeight: '700' },
  cancelConfirmation: {
    gap: spacing.sm,
    borderRadius: radii.panel,
    backgroundColor: '#FFF3E9',
    padding: spacing.md,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: { flex: 2 },
})
