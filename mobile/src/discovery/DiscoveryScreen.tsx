import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import type { AppointmentApi } from '@/appointments/appointment-api'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { CRISIS_SUPPORT_CONTENT } from '@/crisis-support/crisis-support-content'
import { localDateInTimeZone, shiftLocalDate } from '@/resources/resource-model'
import { useDashboardFonts } from '@/theme/useDashboardFonts'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { DiscoveryApi } from './discovery-api'
import type {
  DiscoveryCriteria,
  DiscoveryItem,
  DiscoverySlot,
} from './discovery-contract'
import {
  discoveryError,
  languageLabels,
  modalityLabels,
  selectedHandoff,
  supportAreaLabels,
  type SlotSelection,
} from './discovery-model'
import { SpecialistProfileView, type ProfileTab } from './SpecialistProfileView'

type Props = Readonly<{
  api: DiscoveryApi
  appointmentApi?: AppointmentApi
  onBack: () => void
  onBook?: (selection: SlotSelection) => void
  supportEvaluationId?: string
  returnProfileId?: string
  isRescheduling?: boolean
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

const emergencyContact = CRISIS_SUPPORT_CONTENT.contacts[0]

function callEmergency() {
  void Linking.openURL(`tel:${emergencyContact.phone}`).catch(() =>
    Alert.alert('Chưa thể mở ứng dụng gọi điện', emergencyContact.phone),
  )
}

function formatEarliestSlot(slot: DiscoverySlot, now: Date) {
  const start = new Date(slot.startAt)
  const today = localDateInTimeZone(now, slot.timezone)
  const slotDay = localDateInTimeZone(start, slot.timezone)
  const day =
    slotDay === today
      ? 'Hôm nay'
      : slotDay === shiftLocalDate(today, 1)
        ? 'Ngày mai'
        : new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            timeZone: slot.timezone,
          }).format(start)
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: slot.timezone,
  }).format(start)
  return `${day}, ${time}`
}

function AccountDiscoveryScreen({
  api,
  appointmentApi,
  onBack,
  onBook,
  subject,
  supportEvaluationId,
  returnProfileId,
  isRescheduling = false,
}: Props & { subject: string }) {
  const client = useQueryClient()
  const [draft, setDraft] = useState<DiscoveryCriteria>({})
  const [criteria, setCriteria] = useState<DiscoveryCriteria>({})
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const [profileId, setProfileId] = useState<string | null>(
    returnProfileId ?? null,
  )
  const [profileTab, setProfileTab] = useState<ProfileTab>(
    returnProfileId ? 'slots' : 'profile',
  )
  const [selection, setSelection] = useState<SlotSelection | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [notice, setNotice] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const fontsLoaded = useDashboardFonts()
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const sequence = useRef(0)

  const requestCriteria: DiscoveryCriteria = {
    ...criteria,
    ...(supportEvaluationId ? { supportEvaluationId } : {}),
  }

  const credits = useQuery({
    queryKey: ['appointment-credits', subject],
    queryFn: appointmentApi ? () => appointmentApi.credits() : skipToken,
    enabled: Boolean(subject) && Boolean(appointmentApi),
    retry: false,
    staleTime: 60_000,
  })

  const page = useQuery({
    queryKey: [
      'specialist-discovery',
      subject,
      requestCriteria,
      cursors.at(-1),
    ],
    queryFn: () => api.list(requestCriteria, cursors.at(-1)),
    enabled: profileId === null || Boolean(returnProfileId),
    retry: false,
    staleTime: 0,
  })

  const detailKey = [
    'specialist-discovery-detail',
    subject,
    profileId,
    requestCriteria,
  ]
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: () => api.detail(profileId!, requestCriteria),
    enabled: profileId !== null,
    retry: false,
    staleTime: 0,
  })
  const credentialBadges = useQuery({
    queryKey: ['specialist-credential-badges', subject, profileId],
    queryFn: profileId && api.badges ? () => api.badges!(profileId) : skipToken,
    retry: false,
  })

  const refetchPage = page.refetch
  const refetchDetail = detail.refetch
  const refetchCredits = credits.refetch

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
        if (appointmentApi) void refetchCredits()
      }
    })
    return () => {
      sequence.current += 1
      subscription.remove()
    }
  }, [appointmentApi, profileId, refetchCredits, refetchDetail, refetchPage])

  function refresh() {
    discardSelection()
    setBlocked(false)
    if (profileId) void refetchDetail()
    else void refetchPage()
    if (appointmentApi) void refetchCredits()
  }

  async function select(slot: DiscoverySlot) {
    discardSelection()
    const request = sequence.current
    setVerifying(true)
    try {
      const policy = await api.list(requestCriteria)
      const item = await api.detail(slot.specialistAccountId, requestCriteria)
      if (request !== sequence.current) return
      const handoff = selectedHandoff(item, slot, policy)
      const stored = client.setQueryData<DiscoveryItem>(detailKey, item)
      if (!handoff) {
        setNotice(
          'Khung giờ đã thay đổi hoặc không còn chọn được. Hãy tải lại và chọn giờ khác.',
        )
        setBlocked(true)
      } else {
        const verified = { ...handoff, specialist: stored ?? item }
        if (
          onBook &&
          handoff.bookingHandoff === 'BOOKING_POLICY_CHECK_REQUIRED' &&
          (isRescheduling || credits.data?.balance.available !== 0)
        ) {
          onBook(verified)
        } else {
          setSelection(verified)
        }
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

  const currentPackageCode = credits.data?.packageCode ?? page.data?.packageCode
  const remainingCredits = credits.data?.balance.available
  const slotDuration = page.data?.items[0]?.selectableSlots[0]
  const minutes = slotDuration
    ? (Date.parse(slotDuration.endAt) - Date.parse(slotDuration.startAt)) /
      60000
    : null

  const displayedItems = useMemo(() => {
    const rawItems = results?.items ?? []
    if (!searchKeyword.trim()) return rawItems
    const kw = searchKeyword.trim().toLowerCase()
    return rawItems.filter(
      (spec) =>
        spec.displayName.toLowerCase().includes(kw) ||
        spec.bio.toLowerCase().includes(kw) ||
        spec.supportAreas.some((area) =>
          (supportAreaLabels[area] || '').toLowerCase().includes(kw),
        ),
    )
  }, [results?.items, searchKeyword])

  const handleChipSelect = (
    supportArea?: 'ANXIETY_SYMPTOMS' | 'DEPRESSIVE_SYMPTOMS',
  ) => {
    discardSelection()
    setBlocked(false)
    setCursors([undefined])
    const newCriteria: DiscoveryCriteria = {
      ...criteria,
      supportArea,
    }
    setDraft({ ...draft, supportArea })
    setCriteria(newCriteria)
  }

  if (profileId) {
    return (
      <SpecialistProfileView
        key={profileId}
        item={item}
        badges={credentialBadges.isSuccess ? credentialBadges.data : []}
        tab={profileTab}
        loading={loading}
        verifying={verifying}
        error={
          notice ||
          (detail.isError
            ? discoveryError(detail.error)
            : blocked
              ? 'Hãy tải lại để kiểm tra hồ sơ và khung giờ.'
              : '')
        }
        selection={currentSelection}
        browseOnly={
          page.data?.bookingHandoff !== 'BOOKING_POLICY_CHECK_REQUIRED' ||
          !onBook
        }
        credits={isRescheduling ? undefined : remainingCredits}
        fontsLoaded={fontsLoaded}
        onClose={() => {
          discardSelection()
          setBlocked(false)
          setProfileId(null)
        }}
        onTab={setProfileTab}
        onRetry={() => {
          refresh()
          if (api.badges) void credentialBadges.refetch()
        }}
        onSelect={(slot) => void select(slot)}
        onChooseOther={() => {
          setProfileTab('slots')
          refresh()
        }}
      />
    )
  }

  return (
    <Screen
      key={`list-${cursors.length}`}
      layout="dashboard"
      backgroundColor="#F8FAF8"
    >
      <View style={styles.stack}>
        {/* 1. Header / Masthead */}
        <View style={styles.masthead}>
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <Text accessible={false} style={styles.brandLeaf}>
                ✿
              </Text>
            </View>
            <Text style={[styles.brandTitle, fontsLoaded && styles.serif]}>
              MentalBridge
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Gọi ${emergencyContact.name}`}
            style={styles.sosPill}
            onPress={callEmergency}
          >
            <Text style={styles.sosAsterisk}>✻</Text>
            <Text style={styles.sosLabel}>SOS {emergencyContact.phone}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hồ sơ người dùng"
            style={styles.userProfileCircle}
            onPress={() => router.push('/(user)/profile')}
          >
            <Text accessible={false} style={styles.userProfileIcon}>
              ◎
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Về trang chính"
          onPress={onBack}
          style={styles.backHomeRow}
        >
          <Text style={styles.backHomeText}>← Về trang chính</Text>
        </Pressable>

        <Secondary
          label="Thông báo lịch hẹn"
          onPress={() =>
            router.push({
              pathname: '/(user)/notifications',
              params: { filter: 'appointments' },
            })
          }
        />

        {/* 2. Section Title and Online Status */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconCircle}>
            <Text accessible={false} style={styles.sectionEmoji}>
              ✿
            </Text>
          </View>
          <View style={styles.sectionTitleCol}>
            <Text
              accessibilityRole="header"
              style={[styles.mainTitle, fontsLoaded && styles.serif]}
            >
              Chuyên gia tâm lý
            </Text>
            <Text style={styles.mainSubtitle}>
              Không gian đồng hành tin cậy 1:1
            </Text>
          </View>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineLabel}>Trực tuyến</Text>
          </View>
        </View>

        {/* 3. Package & Feature Highlight Cards (when on list view) */}
        {!profileId && (
          <View style={styles.highlightGrid}>
            {/* Left Big Dark Green Card */}
            <View style={styles.planCard}>
              <View style={styles.planCardTop}>
                <View style={styles.planBadge}>
                  <Text style={styles.planShield}>🛡</Text>
                  <Text style={styles.planBadgeText}>
                    {currentPackageCode
                      ? `GÓI ${currentPackageCode}`
                      : 'QUYỀN LỢI'}
                  </Text>
                </View>
                <View style={styles.planGreenDot} />
              </View>

              <View style={styles.planCardMiddle}>
                {remainingCredits !== undefined ? (
                  <>
                    <Text style={styles.planCountNumber}>
                      {remainingCredits}
                    </Text>
                    <Text style={styles.planCountLabel}>phiên còn lại</Text>
                  </>
                ) : (
                  <Text style={styles.planCountLabel}>
                    {credits.isFetching
                      ? 'Đang tải số phiên…'
                      : 'Chưa có số phiên để hiển thị'}
                  </Text>
                )}
              </View>

              <View style={styles.planCardBottom}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/(user)/appointments')}
                  style={styles.planDetail}
                >
                  <Text style={styles.planDetailText}>
                    Lịch hẹn & quyền lợi →
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Right Two Stacked Cards */}
            <View style={styles.featureCol}>
              <View style={styles.featureCard}>
                <View style={styles.featureIconBox}>
                  <Text accessible={false} style={styles.featureEmoji}>
                    ◷
                  </Text>
                </View>
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>
                    {minutes !== null ? `${minutes} phút` : 'Tư vấn 1:1'}
                  </Text>
                  <Text style={styles.featureDesc}>Trong ứng dụng</Text>
                </View>
              </View>

              <View style={styles.featureCard}>
                <View style={styles.featureIconBox}>
                  <Text accessible={false} style={styles.featureEmoji}>
                    ◇
                  </Text>
                </View>
                <View style={styles.featureTextCol}>
                  <Text style={styles.featureTitle}>Riêng tư</Text>
                  <Text style={styles.featureDesc}>Hồ sơ tư vấn</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 4. Search and Filter Section */}
        {!profileId && (
          <View style={styles.filterSection}>
            {/* Rounded Search Bar */}
            <View style={styles.searchBar}>
              <Text accessible={false} style={styles.searchIconEmoji}>
                ⌕
              </Text>
              <TextInput
                style={styles.searchInput}
                accessibilityLabel="Tìm chuyên gia"
                placeholder="Tìm tên hoặc lĩnh vực hỗ trợ…"
                placeholderTextColor="#707974"
                value={searchKeyword}
                onChangeText={setSearchKeyword}
                clearButtonMode="while-editing"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bộ lọc nâng cao"
                accessibilityState={{ expanded: showAdvancedFilters }}
                style={styles.sliderBtn}
                onPress={() => setShowAdvancedFilters((visible) => !visible)}
              >
                <Text accessible={false} style={styles.sliderEmoji}>
                  ☷
                </Text>
              </Pressable>
            </View>

            {/* Category Quick Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsScroll}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => handleChipSelect(undefined)}
                style={[
                  styles.filterChip,
                  !draft.supportArea && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    !draft.supportArea && styles.filterChipTextActive,
                  ]}
                >
                  Tất cả
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => handleChipSelect('ANXIETY_SYMPTOMS')}
                style={[
                  styles.filterChip,
                  draft.supportArea === 'ANXIETY_SYMPTOMS' &&
                    styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    draft.supportArea === 'ANXIETY_SYMPTOMS' &&
                      styles.filterChipTextActive,
                  ]}
                >
                  Lo âu & Căng thẳng
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => handleChipSelect('DEPRESSIVE_SYMPTOMS')}
                style={[
                  styles.filterChip,
                  draft.supportArea === 'DEPRESSIVE_SYMPTOMS' &&
                    styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    draft.supportArea === 'DEPRESSIVE_SYMPTOMS' &&
                      styles.filterChipTextActive,
                  ]}
                >
                  Khí sắc & Trầm buồn
                </Text>
              </Pressable>
            </ScrollView>

            {/* Advanced Criteria Choices (Accessible Radios for Automated Verification & Detailed Search) */}
            {showAdvancedFilters && (
              <View style={styles.advancedFilterBox}>
                <Text
                  accessibilityRole="header"
                  style={styles.filterGroupTitle}
                >
                  Lĩnh vực hỗ trợ
                </Text>
                <View style={styles.choices}>
                  <Choice
                    label="Mọi lĩnh vực"
                    selected={!draft.supportArea}
                    onPress={() =>
                      setDraft({ ...draft, supportArea: undefined })
                    }
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

                <Text
                  accessibilityRole="header"
                  style={styles.filterGroupTitle}
                >
                  Ngôn ngữ ưu tiên
                </Text>
                <View style={styles.choices}>
                  <Choice
                    label="Mọi ngôn ngữ"
                    selected={!draft.language}
                    onPress={() => setDraft({ ...draft, language: undefined })}
                  />
                  {(['vi', 'en', 'zh', 'fr'] as const).map((language) => (
                    <Choice
                      key={language}
                      label={languageLabels[language]}
                      selected={draft.language === language}
                      onPress={() => setDraft({ ...draft, language })}
                    />
                  ))}
                </View>

                <Text
                  accessibilityRole="header"
                  style={styles.filterGroupTitle}
                >
                  Hình thức
                </Text>
                <View style={styles.choices}>
                  <Choice
                    label="Mọi hình thức"
                    selected={!draft.modality}
                    onPress={() => setDraft({ ...draft, modality: undefined })}
                  />
                  {(['IN_APP_CHAT', 'IN_APP_VIDEO'] as const).map(
                    (modality) => (
                      <Choice
                        key={modality}
                        label={modalityLabels[modality]}
                        selected={draft.modality === modality}
                        onPress={() => setDraft({ ...draft, modality })}
                      />
                    ),
                  )}
                </View>

                <Text
                  accessibilityRole="header"
                  style={styles.filterGroupTitle}
                >
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

                <View style={styles.filterActionsRow}>
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
                      ) {
                        void refetchPage()
                      }
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
                      setShowAdvancedFilters(false)
                      if (!filtered && cursors.length === 1) void refetchPage()
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* 5. AI Matching Banner (when on list view) */}
        {!profileId && (
          <View style={styles.aiMatchingBanner}>
            <View style={styles.aiBrainCircle}>
              <Text accessible={false} style={styles.aiBrainEmoji}>
                ✧
              </Text>
            </View>
            <View style={styles.aiTextCol}>
              <Text style={styles.aiTitle}>Chưa rõ người phù hợp?</Text>
              <Text numberOfLines={1} style={styles.aiDesc}>
                {supportEvaluationId
                  ? 'Gợi ý theo kết quả sàng lọc'
                  : 'Gợi ý theo nhu cầu hỗ trợ'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Gợi ý chuyên gia phù hợp ngay"
              style={styles.aiActionBtn}
              onPress={() => {
                const matched = results?.items.find(
                  (i) => i.explanation.compatibility === 'MATCHED',
                )
                if (matched) {
                  setProfileId(matched.specialistAccountId)
                } else {
                  router.push('/(user)/assessment')
                }
              }}
            >
              <Text style={styles.aiActionText}>Gợi ý ngay ✨</Text>
            </Pressable>
          </View>
        )}

        {/* Loading and Notice states */}
        {loading && (
          <View style={styles.noticeCard}>
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {verifying
                ? 'Đang kiểm tra lại hồ sơ và khung giờ…'
                : 'Đang tải thông tin chuyên gia…'}
            </Text>
          </View>
        )}

        {(notice || current.isError) && (
          <View style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.errorText}>
              {notice || discoveryError(current.error)}
            </Text>
          </View>
        )}

        {!loading && (blocked || current.isError) && (
          <PrimaryButton label="Tải lại thông tin" onPress={refresh} />
        )}

        {/* 6. Specialist Cards List (when on list view) */}
        {!profileId && results && (
          <>
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

            {!displayedItems.length && (
              <View style={styles.emptyCard}>
                <Text style={styles.body}>
                  {filtered || searchKeyword.trim()
                    ? 'Chưa có chuyên gia và khung giờ phù hợp với tiêu chí này. Hãy đổi hoặc xóa bộ lọc.'
                    : 'Chưa có chuyên gia với khung giờ chọn được lúc này. Bạn có thể tải lại sau.'}
                </Text>
              </View>
            )}

            {displayedItems.map((specialist) => {
              const earliestSlot = specialist.selectableSlots.reduce<
                DiscoverySlot | undefined
              >(
                (earliest, slot) =>
                  !earliest ||
                  Date.parse(slot.startAt) < Date.parse(earliest.startAt)
                    ? slot
                    : earliest,
                undefined,
              )
              const slotCount = specialist.selectableSlots.length
              const canChooseSlot =
                slotCount > 0 && results.bookingHandoff !== 'BROWSE_ONLY'
              const rating = specialist.ratingAggregate
              const initials = specialist.displayName
                .trim()
                .split(/\s+/)
                .slice(-2)
                .map((part) => part.slice(0, 1).toLocaleUpperCase('vi-VN'))
                .join('')

              return (
                <View
                  key={specialist.specialistAccountId}
                  style={styles.specialistCard}
                >
                  {/* Card Header: Avatar + Info */}
                  <View style={styles.cardHeaderRow}>
                    {/* Avatar with Online Dot */}
                    <View style={styles.avatarWrapper}>
                      <View style={styles.avatarImage} accessible={false}>
                        <Text style={styles.avatarInitials}>{initials}</Text>
                      </View>
                    </View>

                    {/* Info */}
                    <View style={styles.cardInfoCol}>
                      <View style={styles.nameBadgeRow}>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.specialistNameText,
                            fontsLoaded && styles.serif,
                          ]}
                        >
                          {specialist.displayName}
                        </Text>
                        <View style={styles.verifiedPill}>
                          <Text style={styles.verifiedCheck}>✓</Text>
                          <Text style={styles.verifiedText}>Đã duyệt</Text>
                        </View>
                      </View>

                      <Text
                        numberOfLines={2}
                        style={styles.specialistRoleLabel}
                      >
                        {specialist.bio}
                      </Text>
                      <View style={styles.statsRow}>
                        {rating ? (
                          <Text style={styles.ratingNumber}>
                            ★ {rating.averageRating.toLocaleString('vi-VN')} ·{' '}
                            {rating.ratingCount} đánh giá
                          </Text>
                        ) : (
                          <Text style={styles.statsLabel}>
                            Chưa có đánh giá tổng hợp.
                          </Text>
                        )}
                        <Text style={styles.statsLabel}>
                          {specialist.yearsOfExperience} năm kinh nghiệm
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Tags */}
                  <View style={styles.tagsRow}>
                    {specialist.supportAreas.map((area) => (
                      <View key={area} style={styles.tagPill}>
                        <Text style={styles.tagPillText}>
                          {supportAreaLabels[area]}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Schedule Bar inside Card */}
                  <View style={styles.scheduleBar}>
                    <View style={styles.scheduleLeft}>
                      <Text accessible={false} style={styles.scheduleCalIcon}>
                        ▣
                      </Text>
                      {earliestSlot && (
                        <Text style={styles.scheduleLabel}>Sớm nhất: </Text>
                      )}
                      <Text style={styles.scheduleBoldTime}>
                        {earliestSlot
                          ? formatEarliestSlot(earliestSlot, new Date())
                          : 'Chưa có lịch trống'}
                      </Text>
                    </View>
                    <View style={styles.slotCountBadge}>
                      <Text style={styles.slotCountText}>
                        {`${slotCount} khung giờ`}
                      </Text>
                    </View>
                  </View>

                  {/* Action Buttons: Xem hồ sơ & Đặt lịch hẹn */}
                  <View style={styles.actionsRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Xem hồ sơ ${specialist.displayName}`}
                      testID={`discovery-open-${specialist.specialistAccountId}`}
                      style={styles.profileBtn}
                      onPress={() => {
                        discardSelection()
                        setProfileTab('profile')
                        setProfileId(specialist.specialistAccountId)
                      }}
                    >
                      <Text accessible={false} style={styles.profileBtnIcon}>
                        ▤
                      </Text>
                      <Text style={styles.profileBtnText}>Xem hồ sơ</Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${canChooseSlot ? 'Đặt lịch hẹn cùng' : 'Xem khung giờ của'} ${specialist.displayName}`}
                      style={styles.bookBtn}
                      onPress={() => {
                        discardSelection()
                        setProfileTab('slots')
                        setProfileId(specialist.specialistAccountId)
                      }}
                    >
                      <Text style={styles.bookBtnText}>
                        {canChooseSlot ? 'Đặt lịch hẹn →' : 'Xem khung giờ →'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )
            })}

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

        {/* 7. Trust & Compliance Banner (when on list view) */}
        {!profileId && (
          <View style={styles.trustBanner}>
            <View style={styles.trustShieldCircle}>
              <Text style={styles.trustShieldEmoji}>🛡️</Text>
            </View>
            <View style={styles.trustTextCol}>
              <Text style={styles.trustHeader}>Hồ sơ đã được xét duyệt</Text>
              <Text style={styles.trustBody}>
                Bạn có thể xem hồ sơ đã duyệt, kể cả khi chuyên gia chưa có lịch
                trống.
              </Text>
            </View>
          </View>
        )}

        {/* 8. Emergency / Crisis Support Card (when on list view) */}
        {!profileId && (
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyIconCircle}>
              <Text style={styles.emergencyHeadphoneEmoji}>🎧</Text>
            </View>
            <View style={styles.emergencyTextCol}>
              <Text style={styles.emergencyTitle}>Cần hỗ trợ khẩn cấp?</Text>
              <Text style={styles.emergencySubtitle}>
                Tổng đài khẩn cấp quốc gia
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Gọi ${emergencyContact.name}`}
              style={styles.emergencyCallBtn}
              onPress={callEmergency}
            >
              <Text style={styles.emergencyPhoneEmoji}>📞</Text>
              <Text style={styles.emergencyCallBtnLabel}>
                Gọi {emergencyContact.phone} · {emergencyContact.availability}
              </Text>
            </Pressable>
          </View>
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
  stack: { gap: 14, paddingBottom: 24 },
  serif: { fontFamily: 'DashboardSerif' },
  planDetail: { minHeight: 44, justifyContent: 'center' },
  avatarInitials: { color: colors.tealDeep, fontWeight: '700', fontSize: 16 },
  group: { gap: spacing.sm },

  /* 1. Masthead */
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DCEFE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLeaf: {
    fontSize: 16,
  },
  brandTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#003629',
    letterSpacing: -0.3,
  },
  sosPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDEAE2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sosAsterisk: {
    color: '#9E381A',
    fontSize: 14,
    fontWeight: '800',
  },
  sosLabel: {
    color: '#9E381A',
    fontSize: 11,
    fontWeight: '700',
  },
  userProfileCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#003629',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userProfileIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  backHomeRow: {
    paddingVertical: 2,
  },
  backHomeText: {
    color: '#174E3E',
    fontSize: 13,
    fontWeight: '600',
  },

  /* 2. Section Header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  sectionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5EDE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionEmoji: {
    fontSize: 18,
  },
  sectionTitleCol: {
    flex: 1,
  },
  mainTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#191C1B',
    lineHeight: 26,
  },
  mainSubtitle: {
    fontSize: 12,
    color: '#57615C',
    marginTop: 1,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E5ECE7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1B8756',
  },
  onlineLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#191C1B',
  },

  /* 3. Highlight Grid */
  highlightGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  planCard: {
    flex: 1.25,
    backgroundColor: '#174E3E',
    borderRadius: 20,
    padding: 14,
    justifyContent: 'space-between',
    minHeight: 136,
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  planShield: {
    fontSize: 12,
    color: '#A1DFC6',
  },
  planBadgeText: {
    color: '#A1DFC6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  planCardMiddle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginVertical: 4,
  },
  planCountNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 36,
  },
  planCountLabel: {
    fontSize: 13,
    color: '#D4EADE',
    flexShrink: 1,
  },
  planCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planDetailText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A1DFC6',
  },

  featureCol: {
    flex: 1,
    gap: 8,
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECE9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0F4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureEmoji: {
    fontSize: 15,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#191C1B',
  },
  featureDesc: {
    fontSize: 11,
    color: '#57615C',
    marginTop: 1,
  },

  /* 4. Search and Filters */
  filterSection: {
    gap: 10,
    marginTop: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E8E5',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  searchIconEmoji: {
    fontSize: 15,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#191C1B',
    paddingVertical: 4,
  },
  sliderBtn: {
    padding: 4,
  },
  sliderEmoji: {
    fontSize: 15,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E4E2',
  },
  filterChipActive: {
    backgroundColor: '#174E3E',
    borderColor: '#174E3E',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#404945',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  advancedFilterBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8ECE9',
    gap: 10,
  },
  filterGroupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#191C1B',
  },
  filterActionsRow: {
    gap: 6,
    marginTop: 6,
  },

  /* 5. AI Matching Banner */
  aiMatchingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DDE7E1',
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  aiBrainCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#174E3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBrainEmoji: {
    fontSize: 18,
  },
  aiTextCol: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#191C1B',
  },
  aiDesc: {
    fontSize: 11,
    color: '#57615C',
    marginTop: 1,
  },
  aiActionBtn: {
    backgroundColor: '#174E3E',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  aiActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  /* 6. Specialist Cards */
  specialistCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ECEEEC',
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarWrapper: {
    width: 54,
    height: 54,
    borderRadius: 27,
    position: 'relative',
  },
  avatarImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E2EBE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfoCol: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  specialistNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#191C1B',
    flex: 1,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DDF4EB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  verifiedCheck: {
    fontSize: 11,
    color: '#0F5132',
    fontWeight: '800',
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F5132',
  },
  specialistRoleLabel: {
    fontSize: 12,
    color: '#57615C',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#191C1B',
  },
  statsLabel: {
    fontSize: 11,
    color: '#57615C',
  },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagPill: {
    backgroundColor: '#F0F4F2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagPillText: {
    fontSize: 12,
    color: '#404945',
    fontWeight: '500',
  },

  scheduleBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F7F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scheduleLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  scheduleCalIcon: {
    fontSize: 13,
  },
  scheduleLabel: {
    fontSize: 12,
    color: '#57615C',
  },
  scheduleBoldTime: {
    fontSize: 12,
    fontWeight: '800',
    color: '#191C1B',
  },
  slotCountBadge: {
    backgroundColor: '#D4F1E4',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  slotCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0E6245',
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  profileBtn: {
    flex: 1,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#F0F3F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  profileBtnIcon: {
    fontSize: 14,
  },
  profileBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#191C1B',
  },
  bookBtn: {
    flex: 1.25,
    height: 42,
    borderRadius: 999,
    backgroundColor: '#174E3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* 7. Trust Banner */
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF4F0',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginTop: 4,
  },
  trustShieldCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DFEBE3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustShieldEmoji: {
    fontSize: 18,
  },
  trustTextCol: {
    flex: 1,
  },
  trustHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#191C1B',
  },
  trustBody: {
    fontSize: 11,
    color: '#57615C',
    marginTop: 2,
    lineHeight: 16,
  },

  /* 8. Emergency Card */
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECE6',
    borderRadius: 18,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  emergencyIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#8C3118',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyHeadphoneEmoji: {
    fontSize: 17,
    color: '#FFFFFF',
  },
  emergencyTextCol: {
    flex: 1,
  },
  emergencyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#571B00',
  },
  emergencySubtitle: {
    fontSize: 11,
    color: '#8C3118',
    marginTop: 1,
  },
  emergencyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#571B00',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emergencyPhoneEmoji: {
    fontSize: 11,
  },
  emergencyCallBtnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Profile Detail View */

  /* Common utilities */
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
  },
  choiceSelected: { backgroundColor: colors.tealDeep },
  chosenText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  noticeCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8ECE9',
  },
  errorCard: {
    backgroundColor: '#FDECE6',
    padding: 14,
    borderRadius: 14,
  },
  errorText: {
    color: '#8C3118',
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8ECE9',
    alignItems: 'center',
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    lineHeight: typography.headingLineHeight,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  muted: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
  },
  secondary: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  secondaryText: {
    color: colors.tealDeep,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: { opacity: 0.82 },
})
