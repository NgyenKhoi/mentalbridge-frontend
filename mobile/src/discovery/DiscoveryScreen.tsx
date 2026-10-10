import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'

import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { DiscoveryApi } from './discovery-api'
import type {
  DiscoveryCriteria,
  DiscoveryItem,
  DiscoverySlot,
} from './discovery-contract'
import {
  discoveryError,
  explanationText,
  languageLabels,
  modalityLabels,
  selectedHandoff,
  slotLabel,
  supportAreaLabels,
  type SlotSelection,
} from './discovery-model'

type Props = Readonly<{
  api: DiscoveryApi
  onBack: () => void
  onBook?: (selection: SlotSelection) => void
}>

function Choice({
  label,
  selected,
  onPress,
}: Readonly<{
  label: string
  selected: boolean
  onPress: () => void
}>) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={selected ? styles.chosenText : styles.body}>{label}</Text>
    </Pressable>
  )
}
function Secondary({
  label,
  onPress,
}: Readonly<{ label: string; onPress: () => void }>) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  )
}
function Profile({
  item,
  full = false,
}: Readonly<{ item: DiscoveryItem; full?: boolean }>) {
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.subtitle}>
        {item.displayName}
      </Text>
      <Text style={styles.body}>
        {item.supportAreas.map((area) => supportAreaLabels[area]).join(' · ')}
      </Text>
      <Text style={styles.muted}>
        {item.languages.map((language) => languageLabels[language]).join(' · ')}{' '}
        · {item.yearsOfExperience} năm kinh nghiệm
      </Text>
      {full && <Text style={styles.body}>{item.bio}</Text>}
      <Text style={styles.muted}>Múi giờ: {item.timezone}</Text>
      <Text style={styles.muted}>
        {item.ratingAggregate
          ? `${item.ratingAggregate.averageRating.toLocaleString('vi-VN')} / 5 · ${item.ratingAggregate.ratingCount} đánh giá`
          : 'Chưa có đánh giá tổng hợp.'}
      </Text>
      <Text style={styles.muted}>{explanationText(item)}</Text>
    </View>
  )
}

function AccountDiscoveryScreen({
  api,
  onBack,
  onBook,
  subject,
}: Props & { subject: string }) {
  const client = useQueryClient()
  const [draft, setDraft] = useState<DiscoveryCriteria>({})
  const [criteria, setCriteria] = useState<DiscoveryCriteria>({})
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const [profileId, setProfileId] = useState<string | null>(null)
  const [selection, setSelection] = useState<SlotSelection | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [notice, setNotice] = useState('')
  const sequence = useRef(0)
  const page = useQuery({
    queryKey: ['specialist-discovery', subject, criteria, cursors.at(-1)],
    queryFn: () => api.list(criteria, cursors.at(-1)),
    enabled: profileId === null,
    retry: false,
    staleTime: 0,
  })
  const detailKey = [
    'specialist-discovery-detail',
    subject,
    profileId,
    criteria,
  ]
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: () => api.detail(profileId!, criteria),
    enabled: profileId !== null,
    retry: false,
    staleTime: 0,
  })
  const refetchPage = page.refetch
  const refetchDetail = detail.refetch
  const discardSelection = () => {
    sequence.current += 1
    setSelection(null)
    setVerifying(false)
    setNotice('')
  }
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      sequence.current += 1
      setSelection(null)
      setVerifying(false)
      setBlocked(true)
      if (state === 'active') {
        setBlocked(false)
        if (profileId) void refetchDetail()
        else void refetchPage()
      }
    })
    return () => {
      sequence.current += 1
      subscription.remove()
    }
  }, [profileId, refetchDetail, refetchPage])

  function refresh() {
    discardSelection()
    setBlocked(false)
    if (profileId) void refetchDetail()
    else void refetchPage()
  }
  async function select(slot: DiscoverySlot) {
    discardSelection()
    const request = sequence.current
    setVerifying(true)
    try {
      const policy = await api.list(criteria)
      const item = await api.detail(slot.specialistAccountId, criteria)
      if (request !== sequence.current) return
      const handoff = selectedHandoff(item, slot, policy)
      const stored = client.setQueryData<DiscoveryItem>(detailKey, item)
      if (!handoff) {
        setNotice(
          'Khung giờ đã thay đổi hoặc không còn chọn được. Hãy tải lại và chọn giờ khác.',
        )
        setBlocked(true)
      } else {
        setSelection({ ...handoff, specialist: stored ?? item })
      }
    } catch (error) {
      if (request !== sequence.current) return
      setNotice(discoveryError(error))
      setBlocked(true)
    } finally {
      if (request === sequence.current) setVerifying(false)
    }
  }

  const current = profileId ? detail : page
  const loading = current.isPending || current.isFetching || verifying
  const item = !loading && !blocked && !detail.isError ? detail.data : undefined
  const currentSelection = item === selection?.specialist ? selection : null
  const results = !loading && !blocked && !page.isError ? page.data : undefined
  const filtered = Object.values(criteria).some(Boolean)

  return (
    <Screen key={profileId ?? `list-${cursors.length}`}>
      <View style={styles.stack}>
        <Secondary
          label={profileId ? 'Quay lại danh sách chuyên gia' : 'Về trang chính'}
          onPress={() => {
            discardSelection()
            setBlocked(false)
            if (profileId) setProfileId(null)
            else onBack()
          }}
        />
        <Text style={styles.eyebrow}>ĐỒNG HÀNH CÙNG BẠN</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {profileId ? 'Hồ sơ chuyên gia' : 'Tìm chuyên gia'}
        </Text>
        {!profileId && (
          <>
            <Text style={styles.body}>
              Khám phá chuyên gia đã được duyệt và khung giờ trực tuyến. Chọn
              giờ chưa tạo lịch hẹn.
            </Text>
            <View style={styles.group}>
              <Text accessibilityRole="header" style={styles.subtitle}>
                Lĩnh vực hỗ trợ
              </Text>
              <View style={styles.choices}>
                <Choice
                  label="Mọi lĩnh vực"
                  selected={!draft.supportArea}
                  onPress={() => setDraft({ ...draft, supportArea: undefined })}
                />
                {Object.entries(supportAreaLabels).map(([value, label]) => (
                  <Choice
                    key={value}
                    label={label}
                    selected={draft.supportArea === value}
                    onPress={() =>
                      setDraft({
                        ...draft,
                        supportArea:
                          value === 'DEPRESSIVE_SYMPTOMS'
                            ? value
                            : 'ANXIETY_SYMPTOMS',
                      })
                    }
                  />
                ))}
              </View>
              <Text accessibilityRole="header" style={styles.subtitle}>
                Ngôn ngữ ưu tiên
              </Text>
              <View style={styles.choices}>
                <Choice
                  label="Mọi ngôn ngữ"
                  selected={!draft.language}
                  onPress={() => setDraft({ ...draft, language: undefined })}
                />
                {(['vi', 'en'] as const).map((language) => (
                  <Choice
                    key={language}
                    label={languageLabels[language]}
                    selected={draft.language === language}
                    onPress={() => setDraft({ ...draft, language })}
                  />
                ))}
              </View>
              <Text accessibilityRole="header" style={styles.subtitle}>
                Hình thức
              </Text>
              <View style={styles.choices}>
                <Choice
                  label="Mọi hình thức"
                  selected={!draft.modality}
                  onPress={() => setDraft({ ...draft, modality: undefined })}
                />
                {(['IN_APP_CHAT', 'IN_APP_VIDEO'] as const).map((modality) => (
                  <Choice
                    key={modality}
                    label={modalityLabels[modality]}
                    selected={draft.modality === modality}
                    onPress={() => setDraft({ ...draft, modality })}
                  />
                ))}
              </View>
              <Text accessibilityRole="header" style={styles.subtitle}>
                Múi giờ ưu tiên
              </Text>
              <View style={styles.choices}>
                <Choice
                  label="Không ưu tiên múi giờ"
                  selected={!draft.timezone}
                  onPress={() => setDraft({ ...draft, timezone: undefined })}
                />
                <Choice
                  label="Giờ Việt Nam"
                  selected={draft.timezone === 'Asia/Ho_Chi_Minh'}
                  onPress={() =>
                    setDraft({ ...draft, timezone: 'Asia/Ho_Chi_Minh' })
                  }
                />
              </View>
              <PrimaryButton
                label="Tìm theo tiêu chí"
                onPress={() => {
                  discardSelection()
                  setBlocked(false)
                  setCursors([undefined])
                  setCriteria({ ...draft })
                  if (
                    JSON.stringify(draft) === JSON.stringify(criteria) &&
                    cursors.length === 1
                  )
                    void refetchPage()
                }}
              />
              <Secondary
                label="Xóa bộ lọc"
                onPress={() => {
                  discardSelection()
                  setBlocked(false)
                  setDraft({})
                  setCriteria({})
                  setCursors([undefined])
                  if (!filtered && cursors.length === 1) void refetchPage()
                }}
              />
            </View>
          </>
        )}
        {loading && (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {verifying
              ? 'Đang kiểm tra lại hồ sơ và khung giờ…'
              : 'Đang tải thông tin chuyên gia…'}
          </Text>
        )}
        {(notice || current.isError) && (
          <Text accessibilityRole="alert" style={styles.body}>
            {notice || discoveryError(current.error)}
          </Text>
        )}
        {!loading && (blocked || current.isError) && (
          <PrimaryButton label="Tải lại thông tin" onPress={refresh} />
        )}
        {!profileId && results && (
          <>
            <Text accessibilityRole="header" style={styles.subtitle}>
              Chuyên gia đang có khung giờ
            </Text>
            <Text style={styles.muted}>
              Thứ tự và lý do hiển thị được cung cấp bởi hệ thống; không phân
              tích nhật ký hay trò chuyện của bạn.
            </Text>
            {results.contextState === 'UNAVAILABLE' && (
              <Text style={styles.muted}>
                Gợi ý sau sàng lọc hiện chưa khả dụng; bạn vẫn có thể xem theo
                tiêu chí còn lại.
              </Text>
            )}
            {!results.videoEnabled && (
              <Text style={styles.muted}>
                Video hiện chưa khả dụng. Bạn vẫn có thể tìm khung giờ chat.
              </Text>
            )}
            {!results.items.length && (
              <Text style={styles.body}>
                {filtered
                  ? 'Chưa có chuyên gia và khung giờ phù hợp với tiêu chí này. Hãy đổi hoặc xóa bộ lọc.'
                  : 'Chưa có chuyên gia với khung giờ chọn được lúc này. Bạn có thể tải lại sau.'}
              </Text>
            )}
            {results.items.map((specialist) => (
              <View key={specialist.specialistAccountId} style={styles.panel}>
                <Profile item={specialist} />
                <PrimaryButton
                  label={`Xem hồ sơ ${specialist.displayName}`}
                  testID={`discovery-open-${specialist.specialistAccountId}`}
                  onPress={() => {
                    discardSelection()
                    setProfileId(specialist.specialistAccountId)
                  }}
                />
              </View>
            ))}
            {results.nextCursor && (
              <PrimaryButton
                label="Xem trang tiếp"
                onPress={() => {
                  discardSelection()
                  setCursors([...cursors, results.nextCursor!])
                }}
              />
            )}
            {cursors.length > 1 && (
              <Secondary
                label="Về trang trước"
                onPress={() => setCursors(cursors.slice(0, -1))}
              />
            )}
            <Secondary label="Tải lại danh sách" onPress={refresh} />
          </>
        )}
        {profileId && item && (
          <>
            <Profile item={item} full />
            {currentSelection ? (
              <View style={styles.panel} testID="discovery-selection-summary">
                <Text accessibilityRole="header" style={styles.subtitle}>
                  Khung giờ đã chọn
                </Text>
                <Text style={styles.body}>
                  {slotLabel(currentSelection.slot)}
                </Text>
                <Text style={styles.body}>
                  {modalityLabels[currentSelection.slot.modality]} · 60 phút
                </Text>
                <Text style={styles.muted}>
                  Múi giờ: {currentSelection.slot.timezone}
                </Text>
                <Text style={styles.body}>
                  {currentSelection.bookingHandoff === 'BROWSE_ONLY'
                    ? 'Bạn đang xem khung giờ tham khảo. Gói hiện tại chỉ cho phép duyệt xem, chưa thể gửi yêu cầu đặt lịch.'
                    : 'Khung giờ đã sẵn sàng cho bước đặt lịch. Chưa gửi yêu cầu và chưa giữ chỗ. Quyền đặt lịch và khung giờ sẽ được kiểm tra lại ở bước đó.'}
                </Text>
                {onBook &&
                  currentSelection.bookingHandoff ===
                    'BOOKING_POLICY_CHECK_REQUIRED' && (
                    <PrimaryButton
                      label="Tiếp tục đặt lịch"
                      testID="discovery-book-handoff"
                      onPress={() => onBook(currentSelection)}
                    />
                  )}
                <Secondary label="Chọn giờ khác" onPress={refresh} />
              </View>
            ) : (
              <>
                <Text accessibilityRole="header" style={styles.subtitle}>
                  Chọn khung giờ 60 phút
                </Text>
                <Text style={styles.muted}>
                  Giờ hiển thị theo múi giờ của chuyên gia. Tình trạng khung giờ
                  được kiểm tra lại khi bạn chọn.
                </Text>
                {item.selectableSlots.map((slot) => (
                  <View key={slot.id} style={styles.panel}>
                    <Text style={styles.body}>{slotLabel(slot)}</Text>
                    <Text style={styles.muted}>
                      {modalityLabels[slot.modality]} · 60 phút
                    </Text>
                    <PrimaryButton
                      label={`Chọn ${slotLabel(slot)}`}
                      testID={`discovery-select-${slot.id}`}
                      onPress={() => void select(slot)}
                    />
                  </View>
                ))}
              </>
            )}
            <Secondary label="Tải lại hồ sơ và khung giờ" onPress={refresh} />
          </>
        )}
        {!profileId && page.isError && (
          <Secondary
            label="Tìm lại từ đầu"
            onPress={() => {
              discardSelection()
              setCursors([undefined])
              void refetchPage()
            }}
          />
        )}
      </View>
    </Screen>
  )
}

export function DiscoveryScreen(props: Props) {
  const { session } = useSession()
  if (session?.role !== 'USER')
    return (
      <Screen>
        <Text style={styles.body}>
          Vui lòng đăng nhập bằng tài khoản dành cho người dùng để xem chuyên
          gia.
        </Text>
        <Secondary label="Về trang chính" onPress={props.onBack} />
      </Screen>
    )
  return (
    <AccountDiscoveryScreen
      key={session.subject}
      {...props}
      subject={session.subject}
    />
  )
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  group: { gap: spacing.md },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  choiceSelected: { backgroundColor: colors.tealDeep },
  chosenText: {
    color: colors.white,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  panel: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.panel,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    lineHeight: typography.headingLineHeight,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  body: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  muted: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  secondary: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  secondaryText: {
    color: colors.tealDeep,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    fontWeight: '700',
  },
  pressed: { opacity: 0.82 },
})
