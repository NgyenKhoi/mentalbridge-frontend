import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { PressableScale } from '@/components/PressableScale'
import { Screen } from '@/components/Screen'
import type { ResourceApi } from '@/resources/resource-api'
import { Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'
import { communityColors } from './community-theme'

import type { CommunityApi } from './community-api'
import {
  postWriteSchema,
  type CommunityTopicCode,
  type VersionedPost,
} from './community-contract'
import type { CommunityMediaTransport } from './community-media'
import { AttachRow, CommunityMediaEditor } from './CommunityMedia'
import {
  Avatar,
  Chip,
  ChoiceRow,
  CommunityButton,
  CommunityHeader,
  CommunityIcon,
  CommunityMessage,
  communityMessage,
  communityStyles as styles,
  communityText,
  Reveal,
  SelectOverlay,
  SkeletonBlock,
  SkeletonGroup,
  useCommandKey,
  useCommunityAction,
  useIsOnline,
  type AvatarAuthor,
} from './community-ui'

const MAX_CONTENT = 5000
const anonymousAuthor: AvatarAuthor = {
  displayName: '',
  avatarPreset: null,
  state: 'ANONYMOUS',
}
const count = (value: number) =>
  String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function IdentityChoice({
  label,
  selected,
  disabled,
  onPress,
  children,
}: Readonly<{
  label: string
  selected: boolean
  disabled: boolean
  onPress: () => void
  children: ReactNode
}>) {
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      scaleTo={0.98}
      onPress={onPress}
      style={[local.identity, disabled && styles.disabled]}
    >
      <SelectOverlay selected={selected} style={local.identityOn} />
      {children}
      <Txt
        numberOfLines={1}
        style={[
          communityText.body,
          local.identityLabel,
          selected && local.strong,
        ]}
      >
        {label}
      </Txt>
      <CommunityIcon
        name={selected ? 'radiobox-marked' : 'radiobox-blank'}
        color={selected ? communityColors.primaryDeep : communityColors.inkSoft}
      />
    </PressableScale>
  )
}

function SectionTitle({ children }: Readonly<{ children: string }>) {
  return (
    <Txt accessibilityRole="header" style={local.title}>
      {children}
    </Txt>
  )
}

export function CommunityComposer({
  api,
  resources,
  subject,
  initial,
  author,
  transport,
  onCancel,
  onSaved,
}: Readonly<{
  api: CommunityApi
  resources: ResourceApi
  subject: string
  initial: VersionedPost | null
  author?: AvatarAuthor | undefined
  transport: CommunityMediaTransport
  onCancel: () => void
  onSaved: (value: VersionedPost) => void
}>) {
  const [content, setContent] = useState(initial?.post.content ?? '')
  const [topics, setTopics] = useState<CommunityTopicCode[]>(
    initial?.post.topics ?? [],
  )
  const [mode, setMode] = useState<'PROFILE' | 'ANONYMOUS'>(
    initial?.post.author.state === 'ANONYMOUS' ? 'ANONYMOUS' : 'PROFILE',
  )
  const [warning, setWarning] = useState(
    initial?.post.sensitiveContentWarning === 'SENSITIVE_CONTENT',
  )
  const [resourceId, setResourceId] = useState<string | null>(
    initial?.post.resourceAttachment?.resourceId ?? null,
  )
  const [showResources, setShowResources] = useState(false)
  const [mediaIds, setMediaIds] = useState(
    initial?.post.media.map((media) => media.mediaId) ?? [],
  )
  const [mediaBusy, setMediaBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [stale, setStale] = useState(false)
  const action = useCommunityAction()
  const commandKey = useCommandKey()
  const online = useIsOnline()
  const topicQuery = useQuery({
    queryKey: ['community', subject, 'topics'],
    queryFn: () => api.topics(),
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
  // An untouched new post has nothing to lose, so it closes without the confirm step.
  const untouched =
    !initial &&
    !content.trim() &&
    !topics.length &&
    !mediaIds.length &&
    !resourceId
  const requestCancel = useCallback(
    () => (untouched ? onCancel() : setConfirmCancel(true)),
    [untouched, onCancel],
  )
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
        onSaved(value)
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
  const why = !online
    ? 'Bạn đang ngoại tuyến. Hãy kết nối mạng để đăng chia sẻ.'
    : action.busy || unconfirmed || stale
      ? null
      : body.content === ''
        ? 'Viết nội dung bạn muốn chia sẻ.'
        : topics.length === 0
          ? 'Chọn ít nhất một chủ đề cho bài viết.'
          : mediaBusy
            ? 'Hãy chờ tệp tải lên xong trước khi đăng bài.'
            : null
  const footer = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={local.footer}
    >
      {confirmCancel ? (
        <Reveal style={local.confirm}>
          <Txt style={communityText.body}>
            Bỏ bản nháp trong bộ nhớ? Tệp chưa đăng không trở thành nội dung
            công khai và được máy chủ xử lý theo thời hạn lưu giữ.
          </Txt>
          {unconfirmed && (
            <CommunityMessage>
              Yêu cầu trước chưa được xác nhận. Tải lại cộng đồng để kiểm tra
              trước khi tạo một bài khác.
            </CommunityMessage>
          )}
          <CommunityButton
            variant="primary"
            label="Tiếp tục chỉnh sửa"
            onPress={() => setConfirmCancel(false)}
          />
          <CommunityButton
            variant="danger"
            label="Bỏ bản nháp"
            onPress={onCancel}
          />
        </Reveal>
      ) : (
        <>
          {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
          {unconfirmed && (
            <CommunityMessage>
              Giữ nguyên bản nháp để thử lại cùng yêu cầu. Bạn chưa có xác nhận
              bài đã được lưu.
            </CommunityMessage>
          )}
          {stale && (
            <CommunityMessage>
              Quay lại và tải bản mới. Không tự ghi đè thay đổi trên máy chủ.
            </CommunityMessage>
          )}
          {why && <Txt style={communityText.meta}>{why}</Txt>}
          <CommunityButton
            large
            variant="primary"
            testID="community-post-save"
            label={
              action.busy
                ? 'Đang gửi…'
                : unconfirmed
                  ? 'Thử lại cùng yêu cầu'
                  : initial
                    ? 'Lưu thay đổi'
                    : 'Đăng chia sẻ'
            }
            disabled={
              !valid ||
              !online ||
              mediaBusy ||
              action.busy ||
              stale ||
              (initial !== null && initial.etag === null)
            }
            onPress={() => void save()}
          />
        </>
      )}
    </KeyboardAvoidingView>
  )
  return (
    <Screen
      layout="dashboard"
      backgroundColor={communityColors.background}
      header={
        <CommunityHeader
          padded
          title={initial ? 'Sửa chia sẻ' : 'Viết chia sẻ'}
          backLabel="Quay lại cộng đồng"
          onBack={() => {
            if (!action.busy) requestCancel()
          }}
        />
      }
      footer={footer}
    >
      <View style={local.stack}>
        <Reveal step={0} style={local.section}>
          <SectionTitle>Hiển thị tác giả</SectionTitle>
          <View accessibilityRole="radiogroup" style={local.choices}>
            <IdentityChoice
              label={author?.displayName || 'Tên cộng đồng'}
              selected={mode === 'PROFILE'}
              disabled={disabled}
              onPress={() => setMode('PROFILE')}
            >
              <Avatar author={author} size={32} />
            </IdentityChoice>
            <IdentityChoice
              label="Ẩn danh"
              selected={mode === 'ANONYMOUS'}
              disabled={disabled}
              onPress={() => setMode('ANONYMOUS')}
            >
              <Avatar author={anonymousAuthor} size={32} />
            </IdentityChoice>
          </View>
          <Txt style={communityText.meta}>
            {mode === 'ANONYMOUS'
              ? 'Ẩn danh không hiện liên kết hồ sơ trên bài viết. Bình luận của bạn vẫn hiển thị tên cộng đồng; không tự tiết lộ danh tính trong nội dung.'
              : 'Bài viết hiển thị tên và hình đại diện cộng đồng của bạn.'}
          </Txt>
        </Reveal>
        <Reveal step={1} style={local.field}>
          <TextInput
            accessibilityLabel="Nội dung chia sẻ"
            testID="community-post-content"
            multiline
            maxLength={MAX_CONTENT}
            placeholder="Viết trải nghiệm, suy nghĩ hoặc một bước tiến nhỏ…"
            placeholderTextColor={communityColors.inkSoft}
            style={local.input}
            editable={!disabled}
            value={content}
            onChangeText={setContent}
          />
          <Txt style={[communityText.meta, local.counter]}>
            {count(content.length)} / {count(MAX_CONTENT)}
          </Txt>
        </Reveal>
        <Reveal step={2} style={local.section}>
          <SectionTitle>Chọn 1–3 chủ đề</SectionTitle>
          <Txt style={communityText.meta}>
            Giúp người đọc tìm thấy câu chuyện của bạn
          </Txt>
          {topicQuery.isPending && (
            <SkeletonGroup label="Đang tải chủ đề…">
              <View style={styles.row}>
                {[96, 120, 84, 108].map((width) => (
                  <SkeletonBlock
                    key={width}
                    width={width}
                    height={36}
                    radius={radii.pill}
                  />
                ))}
              </View>
            </SkeletonGroup>
          )}
          {topicQuery.isError && (
            <>
              <CommunityMessage>
                {communityMessage(topicQuery.error)}
              </CommunityMessage>
              <CommunityButton
                label="Tải lại chủ đề"
                onPress={() => void topicQuery.refetch()}
              />
            </>
          )}
          {topicQuery.isSuccess && topicQuery.data.length === 0 && (
            <Txt style={communityText.body}>
              Chủ đề đang được cập nhật. Bạn có thể quay lại đăng bài sau.
            </Txt>
          )}
          <View style={styles.row}>
            {topicQuery.data?.map((topic) => (
              <Chip
                key={topic.code}
                label={topic.label}
                selected={topics.includes(topic.code)}
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
              />
            ))}
          </View>
        </Reveal>
        <Reveal step={3} style={local.stack}>
          <View style={local.section}>
            <CommunityMediaEditor
              api={api}
              transport={transport}
              initialMedia={initial?.post.media ?? []}
              disabled={disabled}
              onChange={mediaChange}
            />
            {/* Same rule as the moments strip: a video without a sensitive warning. */}
            {!warning && (
              <Txt style={communityText.meta}>
                Bài có video sẽ xuất hiện trong Khoảnh khắc.
              </Txt>
            )}
          </View>
          <View style={local.section}>
            <SectionTitle>Tài nguyên tham khảo (không bắt buộc)</SectionTitle>
            {resourceId && (
              <>
                <Txt style={communityText.body}>
                  Đã chọn một liên kết tài nguyên; nội dung sẽ mở ở Góc tài
                  nguyên.
                </Txt>
                <CommunityButton
                  variant="quiet"
                  label="Gỡ liên kết tài nguyên"
                  disabled={disabled}
                  onPress={() => setResourceId(null)}
                />
              </>
            )}
            <AttachRow
              icon="link-variant"
              label={
                showResources
                  ? 'Đóng danh sách tài nguyên'
                  : 'Chọn tài nguyên đã rà soát'
              }
              disabled={disabled}
              onPress={() => setShowResources((value) => !value)}
            />
            {showResources && (
              <View style={local.list}>
                {resourceQuery.isPending && (
                  <SkeletonGroup label="Đang tải tài nguyên…">
                    <SkeletonBlock height={20} />
                    <SkeletonBlock width="70%" height={20} />
                  </SkeletonGroup>
                )}
                {resourceQuery.isError && (
                  <CommunityMessage>
                    {communityMessage(resourceQuery.error)}
                  </CommunityMessage>
                )}
                {!resourceQuery.isError &&
                  resourceQuery.data?.pages.map((page, index) => (
                    <View key={index}>
                      {page.fallback === 'unavailable' ? (
                        <CommunityMessage>
                          Danh sách tài nguyên chưa sẵn sàng. Bạn vẫn có thể
                          đăng chia sẻ không kèm liên kết.
                        </CommunityMessage>
                      ) : (
                        page.data.map((resource) => (
                          <ChoiceRow
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
                    variant="quiet"
                    label="Tải thêm tài nguyên"
                    disabled={resourceQuery.isFetchingNextPage}
                    onPress={() => void resourceQuery.fetchNextPage()}
                  />
                )}
              </View>
            )}
          </View>
        </Reveal>
        <Reveal step={4} style={local.section}>
          <PressableScale
            accessibilityRole="switch"
            accessibilityLabel="Cảnh báo nội dung nhạy cảm"
            accessibilityState={{ checked: warning, disabled }}
            disabled={disabled}
            scaleTo={0.98}
            onPress={() => setWarning((value) => !value)}
            style={[local.switchRow, disabled && styles.disabled]}
          >
            <CommunityIcon name="shield-alert-outline" />
            <Txt style={[communityText.body, local.identityLabel]}>
              Cảnh báo nội dung nhạy cảm
            </Txt>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
            >
              <Switch
                accessible={false}
                disabled={disabled}
                value={warning}
                trackColor={{
                  false: communityColors.inkSoft,
                  true: communityColors.primaryDeep,
                }}
                thumbColor={communityColors.white}
              />
            </View>
          </PressableScale>
          {warning && (
            <Txt style={communityText.meta}>
              Người đọc cần chọn xem trước khi nội dung được mở.
            </Txt>
          )}
        </Reveal>
      </View>
    </Screen>
  )
}

const local = StyleSheet.create({
  choices: { gap: spacing.sm },
  identity: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: radii.control,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  identityOn: {
    backgroundColor: communityColors.mint,
    borderColor: communityColors.primaryDeep,
    borderRadius: radii.control,
    borderWidth: 1,
  },
  identityLabel: { flex: 1 },
  strong: { fontWeight: '600' },
  stack: { gap: spacing.xl },
  section: { gap: spacing.md },
  title: {
    color: communityColors.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  field: { gap: spacing.xs },
  input: {
    backgroundColor: communityColors.soft,
    borderRadius: 14,
    color: communityColors.ink,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 140,
    padding: spacing.lg,
    textAlignVertical: 'top',
  },
  counter: { textAlign: 'right' },
  list: { gap: spacing.sm },
  switchRow: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: 14,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  footer: {
    backgroundColor: communityColors.background,
    borderTopColor: communityColors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  confirm: { gap: spacing.sm },
})
