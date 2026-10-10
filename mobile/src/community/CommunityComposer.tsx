import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { BackHandler, Text, TextInput, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { PrimaryButton } from '@/components/PrimaryButton'
import type { ResourceApi } from '@/resources/resource-api'

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
  communityStyles as styles,
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
}: Readonly<{
  api: CommunityApi
  resources: ResourceApi
  subject: string
  initial: VersionedPost | null
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
  const requestCancel = useCallback(() => setConfirmCancel(true), [])
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
  return (
    <View style={styles.column}>
      <CommunityButton
        label="Quay lại cộng đồng"
        disabled={action.busy}
        onPress={requestCancel}
      />
      <Text accessibilityRole="header" style={styles.title}>
        {initial ? 'Sửa chia sẻ của bạn' : 'Chia sẻ với cộng đồng'}
      </Text>
      <Text style={styles.muted}>
        Đây là không gian hỗ trợ đồng đẳng, không phải tư vấn hay đánh giá lâm
        sàng. Bạn không cần kể chi tiết riêng tư.
      </Text>
      <Text style={styles.body}>Nội dung chia sẻ</Text>
      <TextInput
        accessibilityLabel="Nội dung chia sẻ"
        testID="community-post-content"
        multiline
        maxLength={5000}
        style={[styles.input, { minHeight: 160 }]}
        editable={!disabled}
        value={content}
        onChangeText={setContent}
      />
      <Text accessibilityRole="header" style={styles.heading}>
        Chủ đề (chọn 1–3)
      </Text>
      {topicQuery.isPending && (
        <CommunityMessage>Đang tải chủ đề…</CommunityMessage>
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
        <CommunityMessage>Chưa có chủ đề đang mở để đăng bài.</CommunityMessage>
      )}
      <View style={styles.row}>
        {topicQuery.data?.map((topic) => (
          <CommunityButton
            key={topic.code}
            label={topic.label}
            selected={topics.includes(topic.code)}
            disabled={
              disabled || (!topics.includes(topic.code) && topics.length >= 3)
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
      <Text accessibilityRole="header" style={styles.heading}>
        Hiển thị tác giả
      </Text>
      <View style={styles.row}>
        <CommunityButton
          label="Tên cộng đồng"
          selected={mode === 'PROFILE'}
          disabled={disabled}
          onPress={() => setMode('PROFILE')}
        />
        <CommunityButton
          label="Ẩn danh"
          selected={mode === 'ANONYMOUS'}
          disabled={disabled}
          onPress={() => setMode('ANONYMOUS')}
        />
      </View>
      <Text style={styles.muted}>
        Ẩn danh không hiện liên kết hồ sơ trên bài viết. Bình luận của bạn vẫn
        hiển thị tên cộng đồng; không tự tiết lộ danh tính trong nội dung.
      </Text>
      <CommunityButton
        label="Cảnh báo nội dung nhạy cảm"
        selected={warning}
        disabled={disabled}
        onPress={() => setWarning((value) => !value)}
      />
      <CommunityMediaEditor
        api={api}
        transport={transport}
        initialMedia={initial?.post.media ?? []}
        disabled={disabled}
        onChange={mediaChange}
      />
      <Text accessibilityRole="header" style={styles.heading}>
        Tài nguyên tham khảo (không bắt buộc)
      </Text>
      {resourceId && (
        <>
          <CommunityMessage>
            Đã chọn một liên kết tài nguyên; nội dung sẽ mở ở Góc tài nguyên.
          </CommunityMessage>
          <CommunityButton
            label="Gỡ liên kết tài nguyên"
            disabled={disabled}
            onPress={() => setResourceId(null)}
          />
        </>
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
        <View style={styles.column}>
          {resourceQuery.isPending && (
            <CommunityMessage>Đang tải tài nguyên…</CommunityMessage>
          )}
          {resourceQuery.isError && (
            <CommunityMessage>
              {communityMessage(resourceQuery.error)}
            </CommunityMessage>
          )}
          {!resourceQuery.isError &&
            resourceQuery.data?.pages.map((page, index) => (
              <View key={index} style={styles.column}>
                {page.fallback === 'unavailable' ? (
                  <CommunityMessage>
                    Danh sách tài nguyên chưa sẵn sàng. Bạn vẫn có thể đăng chia
                    sẻ không kèm liên kết.
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
      {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
      {unconfirmed && (
        <CommunityMessage>
          Giữ nguyên bản nháp để thử lại cùng yêu cầu. Bạn chưa có xác nhận bài
          đã được lưu.
        </CommunityMessage>
      )}
      {stale && (
        <CommunityMessage>
          Quay lại và tải bản mới. Không tự ghi đè thay đổi trên máy chủ.
        </CommunityMessage>
      )}
      <PrimaryButton
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
          mediaBusy ||
          action.busy ||
          stale ||
          (initial !== null && initial.etag === null)
        }
        onPress={() => void save()}
      />
      {confirmCancel && (
        <View style={styles.card}>
          <Text style={styles.body}>
            Bỏ bản nháp trong bộ nhớ? Tệp chưa đăng không trở thành nội dung
            công khai và được máy chủ xử lý theo thời hạn lưu giữ.
          </Text>
          {unconfirmed && (
            <CommunityMessage>
              Yêu cầu trước chưa được xác nhận. Tải lại cộng đồng để kiểm tra
              trước khi tạo một bài khác.
            </CommunityMessage>
          )}
          <CommunityButton
            label="Tiếp tục chỉnh sửa"
            onPress={() => setConfirmCancel(false)}
          />
          <CommunityButton label="Bỏ bản nháp" onPress={onCancel} />
        </View>
      )}
    </View>
  )
}
