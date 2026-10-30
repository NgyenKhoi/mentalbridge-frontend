import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { ScrollView } from 'react-native'
import { z } from 'zod'

import { ApiError } from '@/api/api-error'
import type { Appointment } from '@/appointments/appointment-contract'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { SupportPlanApi } from './support-plan-api'
import {
  noHomePlanOrigin,
  resolveLegacyHomePlanOrigin,
  type HomePlanOriginInput,
} from './home-plan-context'
import { SupportPlanPersonalizationCard } from './SupportPlanPersonalizationCard'
import { SupportPlanScheduleEditor } from './SupportPlanScheduleEditor'
import type {
  OccurrenceEngagement,
  PlanActionProjection,
  PlanChangeRequest,
  ReplacementReview,
  SupportPlan,
  SupportPlanActions,
  SupportPlanOccurrence,
  UpdateActionScheduleRequest,
} from './support-plan-contract'

type Notice = Readonly<{ message: string; tone: 'error' | 'success' }>
type CommandKey = { signature: string; key: string } | null
type AuthorityRecovery = 'idle' | 'refreshing' | 'blocked'
type AuthorityRecoveryContext = Readonly<{
  successMessage: string
  onRecovered?: () => void
}>

const statusLabels: Record<SupportPlan['status'], string> = {
  DRAFT: 'Bản đề xuất',
  ACTIVE: 'Đang thực hiện',
  PAUSED: 'Đang tạm dừng',
  COMPLETED: 'Đã kết thúc',
  SUPERSEDED: 'Đã được thay thế',
  DISCARDED: 'Đã bỏ',
}

const occurrenceLabels: Record<SupportPlanOccurrence['displayState'], string> =
  {
    SCHEDULED: 'Sắp tới',
    MISSED: 'Chưa ghi nhận',
    COMPLETED: 'Đã hoàn thành',
    SKIPPED: 'Đã bỏ qua',
    CANCELLED: 'Đã hủy theo trạng thái kế hoạch',
  }

const appointmentProgressLabels: Record<Appointment['status'], string> = {
  REQUESTED: 'Đã gửi yêu cầu, đang chờ chuyên gia xác nhận',
  CONFIRMED: 'Chuyên gia đã xác nhận lịch hẹn',
  IN_PROGRESS: 'Buổi tư vấn đang diễn ra',
  SESSION_ENDED: 'Buổi tư vấn đã kết thúc, đang hoàn tất ghi nhận',
  COMPLETED: 'Buổi tư vấn đã hoàn thành',
  REJECTED: 'Chuyên gia chưa thể nhận lịch này',
  EXPIRED: 'Yêu cầu đặt lịch đã hết hạn',
  CANCELLED: 'Lịch hẹn đã được hủy',
}

const helpfulnessOptions = [
  ['NOT_HELPFUL', 'Không hữu ích'],
  ['A_LITTLE_HELPFUL', 'Hơi hữu ích'],
  ['HELPFUL', 'Hữu ích'],
  ['VERY_HELPFUL', 'Rất hữu ích'],
] as const

const barrierOptions = [
  ['LOW_ENERGY', 'Thiếu năng lượng'],
  ['NOT_ENOUGH_TIME', 'Không đủ thời gian'],
  ['DIFFICULT_TO_START', 'Khó bắt đầu'],
  ['NOT_A_GOOD_FIT', 'Chưa phù hợp'],
  ['OTHER', 'Lý do khác'],
] as const

function commandKey(
  ref: React.MutableRefObject<CommandKey>,
  signature: string,
) {
  if (ref.current?.signature !== signature) {
    ref.current = { signature, key: randomUUID() }
  }
  return ref.current.key
}

function isMissing(error: unknown) {
  return error instanceof ApiError && error.status === 404
}

async function optionalPlan(request: Promise<SupportPlan>) {
  try {
    return await request
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
}

function dateWindow() {
  const today = new Date()
  const from = new Date(today)
  const through = new Date(today)
  from.setDate(from.getDate() - 7)
  through.setDate(through.getDate() + 14)
  const format = (value: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value)
  return { from: format(from), through: format(through) }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function professionalSupportAction(
  projection: Awaited<ReturnType<SupportPlanApi['getActions']>> | undefined,
) {
  const action = projection?.focuses
    .flatMap((focus) => focus.actions)
    .find(
      (candidate) =>
        candidate.actionType === 'PROFESSIONAL_SUPPORT' &&
        candidate.pathRole === 'PRIMARY' &&
        candidate.status !== 'ENDED',
    )
  return action && z.uuid().safeParse(action.actionId).success
    ? action
    : undefined
}

function requiresProfessionalSupport(plan: SupportPlan) {
  return plan.templateFamilies.some(
    ({ family }) =>
      family === 'DEPRESSIVE_PROFESSIONAL_ADJUNCT' ||
      family === 'ANXIETY_PROFESSIONAL_ADJUNCT',
  )
}

function latestAppointmentFor(
  action: PlanActionProjection | undefined,
  appointments:
    Awaited<ReturnType<SupportPlanApi['getAppointments']>> | undefined,
) {
  if (!action) return undefined
  return appointments?.items
    .filter((item) => item.originatingPlanActionId === action.actionId)
    .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))[0]
}

function loadErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để xem kế hoạch hỗ trợ.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền xem kế hoạch hỗ trợ cá nhân.'
  }
  return 'Chưa thể tải kế hoạch hỗ trợ lúc này. Dữ liệu đã lưu không bị thay đổi.'
}

function mutationErrorMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    (error.status === 409 || error.status === 412)
  ) {
    return 'Kế hoạch vừa thay đổi ở nơi khác. MentalBridge đang tải lại trạng thái mới nhất.'
  }
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Thao tác chưa được xác nhận.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Bạn không có quyền thực hiện thao tác này.'
  }
  return 'Chưa thể hoàn tất thao tác. Không có thay đổi nào được xác nhận; hãy thử lại.'
}

function StateMessage({ notice }: Readonly<{ notice: Notice }>) {
  return (
    <Text
      accessibilityLiveRegion={notice.tone === 'error' ? 'assertive' : 'polite'}
      style={[
        styles.notice,
        notice.tone === 'error' ? styles.errorText : styles.successText,
      ]}
    >
      {notice.message}
    </Text>
  )
}

function SecondaryButton({
  disabled = false,
  label,
  onPress,
}: Readonly<{ disabled?: boolean; label: string; onPress: () => void }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  )
}

function PlanCard({
  appointment,
  appointmentUnavailable,
  busy,
  canActivate,
  onActivate,
  onChangeChoice,
  onRetryProfessionalSupport,
  onStatus,
  plan,
  focuses,
  focusesLoading,
  focusesUnavailable,
  professionalAction,
  professionalSupportError,
  professionalSupportRefreshing,
  schedulePlan,
  onSaveSchedule,
  onReloadSchedule,
  title,
}: Readonly<{
  appointment?: Appointment | undefined
  appointmentUnavailable: boolean
  busy: boolean
  canActivate: boolean
  onActivate: () => void
  onChangeChoice: (slotId: string, resourceId: string) => void
  onRetryProfessionalSupport: () => void
  onStatus: (status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED') => void
  plan: SupportPlan
  focuses: SupportPlanActions['focuses'] | undefined
  focusesLoading: boolean
  focusesUnavailable: boolean
  professionalAction?: PlanActionProjection | undefined
  professionalSupportError: boolean
  professionalSupportRefreshing: boolean
  schedulePlan: SupportPlanActions | undefined
  onSaveSchedule: (
    actionId: string,
    request: UpdateActionScheduleRequest,
    idempotencyKey: string,
  ) => Promise<void>
  onReloadSchedule: () => Promise<SupportPlanActions | undefined>
  title: string
}>) {
  const [scheduleDirty, setScheduleDirty] = useState(false)
  const showProfessionalSupport = Boolean(
    professionalAction ||
    (professionalSupportError && requiresProfessionalSupport(plan)),
  )
  const scheduleAuthorityMatches = Boolean(
    schedulePlan &&
    schedulePlan.supportPlanId === plan.supportPlanId &&
    schedulePlan.status === plan.status &&
    schedulePlan.version === plan.version,
  )
  const scheduleIdentityMatches = Boolean(
    schedulePlan &&
    schedulePlan.supportPlanId === plan.supportPlanId &&
    schedulePlan.status === plan.status,
  )

  return (
    <View style={styles.planPanel}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.badge}>{statusLabels[plan.status]}</Text>
      </View>
      {plan.safety.status === 'POSITIVE_SAFETY_SCREEN' && (
        <Text accessibilityLiveRegion="assertive" style={styles.safetyText}>
          {plan.safety.guidance}
        </Text>
      )}

      {showProfessionalSupport && (
        <View style={styles.professionalPanel}>
          <Text style={styles.professionalEyebrow}>HƯỚNG HỖ TRỢ CHÍNH</Text>
          <Text style={styles.sectionTitle}>
            {professionalAction?.presentation.title ??
              'Ưu tiên kết nối chuyên gia'}
          </Text>
          {professionalAction?.presentation.summary && (
            <Text style={styles.body}>
              {professionalAction.presentation.summary}
            </Text>
          )}
          {!professionalAction && professionalSupportError && (
            <Text accessibilityLiveRegion="assertive" style={styles.errorText}>
              Chưa thể tải chi tiết hướng hỗ trợ chính. Các nội dung bổ trợ vẫn
              có thể xem, nhưng không thay thế việc kết nối chuyên gia.
            </Text>
          )}
          {professionalAction && professionalSupportError && (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              Chưa thể cập nhật hướng hỗ trợ. Thông tin bên dưới là lần tải đã
              xác nhận gần nhất.
            </Text>
          )}
          {appointment && (
            <Text accessibilityLiveRegion="polite" style={styles.itemTitle}>
              Trạng thái lịch hẹn:{' '}
              {appointmentProgressLabels[appointment.status]}
            </Text>
          )}
          {appointmentUnavailable && (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              Chưa thể cập nhật trạng thái lịch hẹn. MentalBridge không tự suy
              đoán trạng thái khi dữ liệu này chưa khả dụng.
            </Text>
          )}
          <Text style={styles.supportingText}>
            MentalBridge không tự đặt lịch hoặc chia sẻ dữ liệu. Bạn sẽ xem và
            xác nhận từng bước trước khi gửi yêu cầu.
          </Text>
          {professionalAction && (
            <PrimaryButton
              disabled={busy}
              label="Tìm chuyên gia phù hợp"
              onPress={() =>
                router.push({
                  pathname: './specialists',
                  params: { planActionId: professionalAction.actionId },
                })
              }
            />
          )}
          {(professionalSupportError || appointmentUnavailable) && (
            <SecondaryButton
              disabled={professionalSupportRefreshing}
              label={
                professionalSupportRefreshing
                  ? 'Đang tải lại hướng hỗ trợ…'
                  : 'Thử tải lại hướng hỗ trợ'
              }
              onPress={onRetryProfessionalSupport}
            />
          )}
        </View>
      )}

      <View style={styles.focusPanel}>
        <Text style={styles.professionalEyebrow}>TRỌNG TÂM KẾ HOẠCH</Text>
        {focusesLoading && (
          <View style={styles.focusLoading} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.tealDeep} />
            <Text style={styles.supportingText}>
              Đang tải lý do cho từng trọng tâm…
            </Text>
          </View>
        )}
        {focuses?.map((focus) => (
          <View key={focus.focusId} style={styles.focusItem}>
            <View style={styles.focusHeader}>
              <Text style={styles.itemTitle}>{focus.title}</Text>
              {focus.personalizationProvenance && (
                <Text style={styles.personalizedBadge}>
                  Theo lựa chọn của bạn
                </Text>
              )}
            </View>
            {focus.rationale && (
              <Text style={styles.supportingText}>{focus.rationale}</Text>
            )}
          </View>
        ))}
        {focusesUnavailable && (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            Chưa thể tải giải thích theo từng trọng tâm. Lý do tổng quát bên
            dưới vẫn có thể xem và kế hoạch không bị thay đổi.
          </Text>
        )}
        {!focuses && <Text style={styles.body}>{plan.rationale.text}</Text>}
      </View>

      {schedulePlan && scheduleIdentityMatches && (
        <SupportPlanScheduleEditor
          plan={schedulePlan}
          disabled={
            busy || plan.status === 'PAUSED' || !scheduleAuthorityMatches
          }
          {...(plan.status === 'DRAFT'
            ? { onDirtyChange: setScheduleDirty }
            : {})}
          onSave={onSaveSchedule}
          onReload={onReloadSchedule}
        />
      )}

      {plan.slots.map((slot) => (
        <View key={slot.slotId} style={styles.resourceGroup}>
          <Text style={styles.itemTitle}>
            {slot.kind === 'CORE' ? 'Hoạt động chính' : 'Hoạt động bổ sung'}
          </Text>
          {slot.selectedResource ? (
            <>
              <Text style={styles.body}>{slot.selectedResource.title}</Text>
              <Text style={styles.supportingText}>
                {slot.selectedResource.summary}
              </Text>
              {slot.selectedResource.externalUrl && (
                <SecondaryButton
                  disabled={busy}
                  label={`Mở ${slot.selectedResource.title}`}
                  onPress={() =>
                    void Linking.openURL(
                      slot.selectedResource?.externalUrl ?? '',
                    )
                  }
                />
              )}
            </>
          ) : (
            <Text style={styles.supportingText}>
              Chưa chọn hoạt động bổ sung.
            </Text>
          )}
          {plan.status === 'DRAFT' && slot.allowedAlternatives.length > 1 && (
            <View style={styles.choiceList}>
              <Text style={styles.label}>Lựa chọn đủ điều kiện</Text>
              {slot.allowedAlternatives.map((resource) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{
                    checked:
                      slot.selectedResource?.resourceId === resource.resourceId,
                    disabled: busy,
                  }}
                  disabled={busy}
                  key={`${resource.resourceId}:${resource.contentVersion}`}
                  onPress={() =>
                    onChangeChoice(slot.slotId, resource.resourceId)
                  }
                  style={({ pressed }) => [
                    styles.choice,
                    slot.selectedResource?.resourceId === resource.resourceId &&
                      styles.choiceSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.choiceLabel}>{resource.title}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ))}

      <View style={styles.actions}>
        {plan.status === 'DRAFT' && (
          <>
            {canActivate && (
              <PrimaryButton
                disabled={busy || scheduleDirty}
                label={busy ? 'Đang xử lý…' : 'Bắt đầu kế hoạch'}
                onPress={onActivate}
              />
            )}
            {scheduleDirty && (
              <Text style={styles.supportingText}>
                Hãy lưu lịch mới trước khi bắt đầu kế hoạch.
              </Text>
            )}
            <SecondaryButton
              disabled={busy}
              label="Bỏ bản đề xuất"
              onPress={() => onStatus('DISCARDED')}
            />
          </>
        )}
        {plan.status === 'ACTIVE' && (
          <>
            <PrimaryButton
              disabled={busy}
              label="Tạm dừng kế hoạch"
              onPress={() => onStatus('PAUSED')}
            />
            <SecondaryButton
              disabled={busy}
              label="Kết thúc kế hoạch"
              onPress={() => onStatus('COMPLETED')}
            />
          </>
        )}
        {plan.status === 'PAUSED' && (
          <>
            <PrimaryButton
              disabled={busy}
              label="Tiếp tục kế hoạch"
              onPress={() => onStatus('ACTIVE')}
            />
            <SecondaryButton
              disabled={busy}
              label="Kết thúc kế hoạch"
              onPress={() => onStatus('COMPLETED')}
            />
          </>
        )}
      </View>
      <Text style={styles.disclaimer}>{plan.disclaimer}</Text>
    </View>
  )
}

function ProposalCard({
  busy,
  onDecision,
  onReview,
  request,
}: Readonly<{
  busy: boolean
  onDecision: (decision: 'ACCEPT' | 'REJECT') => void
  onReview: () => void
  request: PlanChangeRequest | null | undefined
}>) {
  return (
    <View style={styles.proposalPanel}>
      <Text style={styles.sectionTitle}>Đề xuất sau buổi tư vấn</Text>
      {!request ? (
        <>
          <Text style={styles.body}>
            Kiểm tra đề xuất bằng dữ liệu hiện tại trước khi bạn quyết định.
          </Text>
          <PrimaryButton
            disabled={busy}
            label={busy ? 'Đang kiểm tra…' : 'Xem đề xuất'}
            onPress={onReview}
          />
        </>
      ) : (
        <>
          <Text style={styles.itemTitle}>{request.proposedResource.title}</Text>
          {request.proposalDetails && (
            <Text style={styles.body}>{request.proposalDetails}</Text>
          )}
          {request.status === 'READY_FOR_REVIEW' ? (
            <View style={styles.actions}>
              <PrimaryButton
                disabled={busy}
                label="Chấp nhận đề xuất"
                onPress={() => onDecision('ACCEPT')}
              />
              <SecondaryButton
                disabled={busy}
                label="Từ chối đề xuất"
                onPress={() => onDecision('REJECT')}
              />
            </View>
          ) : (
            <Text style={styles.supportingText}>
              {request.status === 'ACCEPTED'
                ? 'Bạn đã chấp nhận đề xuất này.'
                : 'Bạn đã từ chối đề xuất này.'}
            </Text>
          )}
        </>
      )}
    </View>
  )
}

function OccurrenceCard({
  busy,
  canEdit,
  onSave,
  onReturnLayout,
  occurrence,
  returnedFromHome = false,
}: Readonly<{
  busy: boolean
  canEdit: boolean
  onSave: (engagement: OccurrenceEngagement) => void
  onReturnLayout?: (target: View, heading: Text) => void
  occurrence: SupportPlanOccurrence
  returnedFromHome?: boolean
}>) {
  const [reflection, setReflection] = useState(occurrence.reflection ?? '')
  const activityRef = useRef<View>(null)
  const headingRef = useRef<Text>(null)
  const returnFocused = useRef(false)
  const focusReturn = useCallback(() => {
    if (
      !returnFocused.current &&
      returnedFromHome &&
      activityRef.current &&
      headingRef.current &&
      onReturnLayout
    ) {
      onReturnLayout(activityRef.current, headingRef.current)
      returnFocused.current = true
    }
  }, [onReturnLayout, returnedFromHome])
  useFocusEffect(
    useCallback(() => {
      returnFocused.current = false
      const frame = requestAnimationFrame(focusReturn)
      return () => cancelAnimationFrame(frame)
    }, [focusReturn]),
  )
  const editable = canEdit && occurrence.state !== 'CANCELLED'
  const save = (change: Partial<OccurrenceEngagement>) => {
    if (!editable) return
    const state = change.state ?? occurrence.state
    if (state === 'CANCELLED') return
    onSave({
      state,
      hidden: change.hidden ?? occurrence.hidden,
      helpfulness:
        state === 'COMPLETED'
          ? (change.helpfulness ?? occurrence.helpfulness)
          : null,
      barrierCode:
        state === 'SKIPPED'
          ? (change.barrierCode ?? occurrence.barrierCode)
          : null,
      reflection:
        state === 'SCHEDULED'
          ? null
          : (change.reflection ?? occurrence.reflection),
      summaryReuseApproved:
        state === 'SCHEDULED'
          ? false
          : (change.summaryReuseApproved ?? occurrence.summaryReuseApproved),
    })
  }

  return (
    <View
      ref={activityRef}
      onLayout={focusReturn}
      style={styles.occurrencePanel}
      testID={`plan-activity-${occurrence.occurrenceId}`}
    >
      {returnedFromHome ? (
        <Text accessibilityLiveRegion="polite" style={styles.eyebrow}>
          Hoạt động bạn vừa mở từ Trang chủ
        </Text>
      ) : null}
      <View style={styles.rowBetween}>
        <Text
          ref={headingRef}
          accessible
          accessibilityRole="header"
          style={styles.itemTitle}
        >
          {occurrence.source.title}
        </Text>
        <Text style={styles.badge}>
          {occurrenceLabels[occurrence.displayState]}
        </Text>
      </View>
      <Text style={styles.supportingText}>
        {formatDate(occurrence.scheduledAt)}
      </Text>
      {!canEdit && occurrence.state !== 'CANCELLED' && (
        <Text style={styles.supportingText}>
          Tiếp tục kế hoạch để ghi nhận hoạt động này.
        </Text>
      )}
      {editable && (
        <View style={styles.actions}>
          {occurrence.state !== 'COMPLETED' && (
            <SecondaryButton
              disabled={busy}
              label="Đã hoàn thành"
              onPress={() => save({ state: 'COMPLETED' })}
            />
          )}
          {occurrence.state !== 'SKIPPED' && (
            <SecondaryButton
              disabled={busy}
              label="Bỏ qua lần này"
              onPress={() => save({ state: 'SKIPPED' })}
            />
          )}
          {occurrence.state !== 'SCHEDULED' && (
            <SecondaryButton
              disabled={busy}
              label="Mở lại hoạt động"
              onPress={() => save({ state: 'SCHEDULED' })}
            />
          )}
        </View>
      )}
      {editable && occurrence.state === 'COMPLETED' && (
        <View style={styles.choiceList}>
          <Text style={styles.label}>Hoạt động này hữu ích thế nào?</Text>
          {helpfulnessOptions.map(([value, label]) => (
            <SecondaryButton
              disabled={busy}
              key={value}
              label={`${occurrence.helpfulness === value ? '✓ ' : ''}${label}`}
              onPress={() => save({ helpfulness: value })}
            />
          ))}
        </View>
      )}
      {editable && occurrence.state === 'SKIPPED' && (
        <View style={styles.choiceList}>
          <Text style={styles.label}>Điều gì khiến bạn bỏ qua?</Text>
          {barrierOptions.map(([value, label]) => (
            <SecondaryButton
              disabled={busy}
              key={value}
              label={`${occurrence.barrierCode === value ? '✓ ' : ''}${label}`}
              onPress={() => save({ barrierCode: value })}
            />
          ))}
        </View>
      )}
      {editable &&
        (occurrence.state === 'COMPLETED' ||
          occurrence.state === 'SKIPPED') && (
          <View style={styles.reflectionField}>
            <Text style={styles.label}>Ghi chú riêng (không bắt buộc)</Text>
            <TextInput
              accessibilityLabel={`Ghi chú cho ${occurrence.source.title}`}
              editable={!busy}
              maxLength={500}
              multiline
              onChangeText={setReflection}
              placeholder="Điều bạn muốn ghi nhớ về hoạt động này"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              value={reflection}
            />
            <SecondaryButton
              disabled={busy}
              label="Lưu ghi chú"
              onPress={() => save({ reflection: reflection.trim() || null })}
            />
            <SecondaryButton
              disabled={busy}
              label={`${occurrence.summaryReuseApproved ? '✓ ' : ''}Cho phép dùng trong bản tổng hợp sau này`}
              onPress={() =>
                save({ summaryReuseApproved: !occurrence.summaryReuseApproved })
              }
            />
          </View>
        )}
      <Text style={styles.disclaimer}>
        Đây là ghi nhận của bạn, không phải điểm tuân thủ hay đánh giá hồi phục.
      </Text>
    </View>
  )
}

export function SupportPlanScreen({
  api,
  homeOrigin = noHomePlanOrigin,
  proposalId,
  nativeProposalEntry,
}: Readonly<{
  api: SupportPlanApi
  homeOrigin?: HomePlanOriginInput
  proposalId?: string
  nativeProposalEntry?: ReactNode
}>) {
  const { session, signOut } = useSession()
  const subject = session?.subject
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<Notice | null>(null)
  const [authorityRecovery, setAuthorityRecovery] =
    useState<AuthorityRecovery>('idle')
  const authorityLockedRef = useRef(false)
  const scrollRef = useRef<ScrollView>(null)
  const contentRef = useRef<View>(null)
  const recoveryRunningRef = useRef(false)
  const recoveryContextRef = useRef<AuthorityRecoveryContext | null>(null)
  const activationKey = useRef<CommandKey>(null)
  const replacementKey = useRef<CommandKey>(null)
  const proposalReviewKey = useRef<CommandKey>(null)
  const proposalDecisionKey = useRef<CommandKey>(null)
  const focusReturnedActivity = useCallback((target: View, heading: Text) => {
    if (!contentRef.current) return
    target.measureLayout(contentRef.current, (_x, y) => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y + spacing.xxxl - spacing.md),
        animated: false,
      })
      AccessibilityInfo.sendAccessibilityEvent?.(heading, 'focus')
    })
  }, [])
  const window =
    homeOrigin.state === 'valid'
      ? {
          from: homeOrigin.value.localDate,
          through: homeOrigin.value.localDate,
        }
      : dateWindow()
  const currentKey = ['support-plan', subject, 'current'] as const
  const draftKey = ['support-plan', subject, 'draft'] as const
  const historyKey = ['support-plan', subject, 'history'] as const
  const actionsKeyFor = (supportPlanId: string | null | undefined) =>
    ['support-plan', subject, 'actions', supportPlanId ?? null] as const
  const occurrenceKeyFor = (supportPlanId: string | null | undefined) =>
    [
      'support-plan',
      subject,
      'occurrences',
      supportPlanId ?? null,
      window.from,
      window.through,
    ] as const
  const replacementReviewKeyFor = (
    currentPlan: SupportPlan | null | undefined,
    draftPlan: SupportPlan | null | undefined,
  ) =>
    [
      'support-plan',
      subject,
      'replacement-review',
      currentPlan?.supportPlanId ?? null,
      currentPlan?.version ?? null,
      draftPlan?.supportPlanId ?? null,
      draftPlan?.version ?? null,
    ] as const
  const proposalKey = ['support-plan', subject, 'proposal', proposalId] as const

  const currentQuery = useQuery({
    queryKey: currentKey,
    enabled: Boolean(subject),
    refetchOnMount: 'always',
    queryFn: () => optionalPlan(api.getCurrent()),
  })
  const draftQuery = useQuery({
    queryKey: draftKey,
    enabled: Boolean(subject),
    refetchOnMount: 'always',
    queryFn: () => optionalPlan(api.getCurrentDraft()),
  })
  const historyQuery = useQuery({
    queryKey: historyKey,
    enabled: Boolean(subject),
    queryFn: () => api.getHistory(),
  })
  const occurrenceKey = occurrenceKeyFor(currentQuery.data?.supportPlanId)
  const occurrenceQuery = useQuery({
    queryKey: occurrenceKey,
    enabled:
      Boolean(subject) &&
      (currentQuery.data?.status === 'ACTIVE' ||
        currentQuery.data?.status === 'PAUSED'),
    queryFn: () => api.getOccurrences(window.from, window.through),
  })
  const replacementQuery = useQuery({
    queryKey: replacementReviewKeyFor(currentQuery.data, draftQuery.data),
    enabled: Boolean(currentQuery.data && draftQuery.data),
    retry: false,
    staleTime: 0,
    queryFn: () => api.reviewReplacement(currentQuery.data!, draftQuery.data!),
  })
  const proposalQuery = useQuery({
    queryKey: proposalKey,
    enabled: Boolean(subject && proposalId),
    refetchOnMount: 'always',
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      try {
        return await api.getPlanChangeRequest(proposalId!)
      } catch (error) {
        if (isMissing(error)) return null
        throw error
      }
    },
  })
  const currentActionsQuery = useQuery({
    queryKey: actionsKeyFor(currentQuery.data?.supportPlanId),
    enabled: Boolean(subject && currentQuery.data?.supportPlanId),
    retry: false,
    queryFn: () => api.getActions(currentQuery.data!.supportPlanId),
  })
  const draftActionsQuery = useQuery({
    queryKey: actionsKeyFor(draftQuery.data?.supportPlanId),
    enabled: Boolean(subject && draftQuery.data?.supportPlanId),
    retry: false,
    queryFn: async () => {
      const value = await api.getCurrentDraftActions()
      if (value.supportPlanId !== draftQuery.data!.supportPlanId) {
        throw new Error(
          'SupportPlan draft action projection identity mismatch.',
        )
      }
      return value
    },
  })
  const currentProfessionalAction = professionalSupportAction(
    currentActionsQuery.data,
  )
  const draftProfessionalAction = professionalSupportAction(
    draftActionsQuery.data,
  )
  const currentAppointmentQuery = useQuery({
    queryKey: [
      'support-plan',
      subject,
      'professional-appointments',
      currentProfessionalAction?.actionId,
    ],
    enabled: Boolean(subject && currentProfessionalAction),
    retry: false,
    staleTime: 0,
    queryFn: () => api.getAppointments(currentProfessionalAction!.actionId),
  })
  const draftAppointmentQuery = useQuery({
    queryKey: [
      'support-plan',
      subject,
      'professional-appointments',
      draftProfessionalAction?.actionId,
    ],
    enabled: Boolean(subject && draftProfessionalAction),
    retry: false,
    staleTime: 0,
    queryFn: () => api.getAppointments(draftProfessionalAction!.actionId),
  })

  const currentSupportsOccurrences =
    currentQuery.data?.status === 'ACTIVE' ||
    currentQuery.data?.status === 'PAUSED'
  const occurrenceAuthorityMismatch = Boolean(
    currentSupportsOccurrences &&
    occurrenceQuery.data &&
    (occurrenceQuery.data.supportPlanId !== currentQuery.data?.supportPlanId ||
      occurrenceQuery.data.supportPlanStatus !== currentQuery.data?.status),
  )

  const refreshAuthority = async () => {
    try {
      const [currentResult, draftResult, historyResult] = await Promise.all([
        currentQuery.refetch(),
        draftQuery.refetch(),
        historyQuery.refetch(),
      ])
      if (
        currentResult.isError ||
        draftResult.isError ||
        historyResult.isError
      ) {
        return false
      }

      const actionResults = await Promise.all([
        ...(currentResult.data ? [currentActionsQuery.refetch()] : []),
        ...(draftResult.data ? [draftActionsQuery.refetch()] : []),
      ])
      if (actionResults.some((result) => result.isError)) return false

      const refreshedCurrent = currentResult.data
      if (
        refreshedCurrent?.status === 'ACTIVE' ||
        refreshedCurrent?.status === 'PAUSED'
      ) {
        const refreshedOccurrenceKey = occurrenceKeyFor(
          refreshedCurrent.supportPlanId,
        )
        await queryClient.invalidateQueries({
          queryKey: refreshedOccurrenceKey,
          exact: true,
          refetchType: 'none',
        })
        const refreshedOccurrences = await queryClient.fetchQuery({
          queryKey: refreshedOccurrenceKey,
          queryFn: () => api.getOccurrences(window.from, window.through),
          staleTime: 0,
        })
        if (
          refreshedOccurrences.supportPlanId !==
            refreshedCurrent.supportPlanId ||
          refreshedOccurrences.supportPlanStatus !== refreshedCurrent.status
        ) {
          return false
        }
      } else {
        queryClient.removeQueries({
          queryKey: ['support-plan', subject, 'occurrences'],
          exact: false,
        })
      }

      if (proposalId) {
        const proposalResult = await proposalQuery.refetch()
        if (proposalResult.isError) return false
      }
      return true
    } catch {
      return false
    }
  }

  const recoverAuthority = async (context?: AuthorityRecoveryContext) => {
    if (context) recoveryContextRef.current = context
    if (recoveryRunningRef.current) return
    authorityLockedRef.current = true
    recoveryRunningRef.current = true
    setAuthorityRecovery('refreshing')

    const recovered = await refreshAuthority()
    recoveryRunningRef.current = false
    if (recovered) {
      const completedRecovery = recoveryContextRef.current
      recoveryContextRef.current = null
      completedRecovery?.onRecovered?.()
      authorityLockedRef.current = false
      setAuthorityRecovery('idle')
      setNotice({
        message:
          completedRecovery?.successMessage ??
          'Đã tải trạng thái mới nhất. Hãy kiểm tra lại trước khi tiếp tục.',
        tone: 'success',
      })
      return
    }

    setAuthorityRecovery('blocked')
    setNotice({
      message:
        'Chưa thể tải trạng thái mới nhất. Các thay đổi đang bị khóa để bảo vệ kế hoạch của bạn.',
      tone: 'error',
    })
  }

  const handleMutationError = (error: unknown) => {
    setNotice({ message: mutationErrorMessage(error), tone: 'error' })
    if (
      error instanceof ApiError &&
      (error.status === 409 || error.status === 412)
    ) {
      authorityLockedRef.current = true
      void recoverAuthority({
        successMessage:
          'Đã tải trạng thái mới nhất. Hãy kiểm tra lại trước khi tiếp tục.',
      })
    }
  }

  const runGovernedMutation = (command: () => void) => {
    if (!authorityLockedRef.current && !occurrenceAuthorityMismatch) command()
  }

  const choiceMutation = useMutation({
    mutationFn: ({
      plan,
      slotId,
      resourceId,
    }: {
      plan: SupportPlan
      slotId: string
      resourceId: string
    }) => {
      const selections = plan.slots.flatMap((slot) => {
        const selected =
          slot.slotId === slotId
            ? slot.allowedAlternatives.find(
                (candidate) => candidate.resourceId === resourceId,
              )
            : slot.selectedResource
        return selected
          ? [
              {
                slotId: slot.slotId,
                resourceId: selected.resourceId,
                contentVersion: selected.contentVersion,
              },
            ]
          : []
      })
      return api.replaceChoices(plan, selections)
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(draftKey, saved)
      setNotice({ message: 'Đã lưu lựa chọn của bạn.', tone: 'success' })
    },
    onError: handleMutationError,
  })
  const scheduleMutation = useMutation({
    mutationFn: async ({
      plan,
      actionId,
      request,
      idempotencyKey,
    }: {
      plan: SupportPlan
      actionId: string
      request: UpdateActionScheduleRequest
      idempotencyKey: string
    }) => ({
      plan,
      projection: await api.replaceSchedule(
        plan,
        actionId,
        request,
        idempotencyKey,
      ),
    }),
    onSuccess: ({ plan, projection }) => {
      queryClient.setQueryData(actionsKeyFor(plan.supportPlanId), projection)
      const planKey =
        currentQuery.data?.supportPlanId === plan.supportPlanId
          ? currentKey
          : draftKey
      queryClient.setQueryData(
        planKey,
        (current: SupportPlan | null | undefined) =>
          current
            ? {
                ...current,
                version: projection.version,
                updatedAt: projection.updatedAt,
              }
            : current,
      )
    },
  })
  const activationMutation = useMutation({
    mutationFn: (plan: SupportPlan) =>
      api.activate(
        plan,
        commandKey(
          activationKey,
          `${plan.supportPlanId}:${plan.version}:activate`,
        ),
      ),
    onSuccess: () => {
      void recoverAuthority({
        successMessage: 'Kế hoạch hỗ trợ đã bắt đầu.',
        onRecovered: () => {
          activationKey.current = null
        },
      })
    },
    onError: handleMutationError,
  })
  const statusMutation = useMutation({
    mutationFn: ({
      plan,
      status,
    }: {
      plan: SupportPlan
      status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED'
    }) => api.changeStatus(plan, status),
    onSuccess: () => {
      void recoverAuthority({
        successMessage: 'Đã cập nhật trạng thái kế hoạch.',
      })
    },
    onError: handleMutationError,
  })
  const occurrenceMutation = useMutation({
    mutationFn: ({
      occurrence,
      engagement,
    }: {
      occurrence: SupportPlanOccurrence
      engagement: OccurrenceEngagement
    }) => api.replaceOccurrenceEngagement(occurrence, engagement),
    onSuccess: (saved) => {
      queryClient.setQueryData(
        occurrenceKey,
        (
          current:
            Awaited<ReturnType<SupportPlanApi['getOccurrences']>> | undefined,
        ) =>
          current
            ? {
                ...current,
                occurrences: current.occurrences.map((occurrence) =>
                  occurrence.occurrenceId === saved.occurrenceId
                    ? saved
                    : occurrence,
                ),
              }
            : current,
      )
      setNotice({ message: 'Đã lưu ghi nhận cho hoạt động.', tone: 'success' })
    },
    onError: handleMutationError,
  })
  const proposalReviewMutation = useMutation({
    mutationFn: (id: string) =>
      api.reviewPlanChangeRequest(
        id,
        commandKey(proposalReviewKey, `${id}:review`),
      ),
    onSuccess: (request) => {
      queryClient.setQueryData(proposalKey, request)
      void recoverAuthority({
        successMessage: 'Đề xuất đã sẵn sàng để bạn quyết định.',
        onRecovered: () => {
          proposalReviewKey.current = null
        },
      })
    },
    onError: handleMutationError,
  })
  const proposalDecisionMutation = useMutation({
    mutationFn: ({
      request,
      decision,
    }: {
      request: PlanChangeRequest
      decision: 'ACCEPT' | 'REJECT'
    }) =>
      api.decidePlanChangeRequest(
        request,
        decision,
        commandKey(
          proposalDecisionKey,
          `${request.requestId}:${request.version}:${decision}`,
        ),
      ),
    onSuccess: (request) => {
      queryClient.setQueryData(proposalKey, request)
      void recoverAuthority({
        successMessage:
          request.status === 'ACCEPTED'
            ? 'Đã áp dụng đề xuất sau khi kiểm tra lại.'
            : 'Đã giữ nguyên kế hoạch hiện tại.',
        onRecovered: () => {
          proposalDecisionKey.current = null
        },
      })
    },
    onError: handleMutationError,
  })
  const replacementMutation = useMutation({
    mutationFn: ({
      current,
      draft,
      review,
    }: {
      current: SupportPlan
      draft: SupportPlan
      review: ReplacementReview
    }) =>
      api.replaceCurrent(
        current,
        draft,
        review,
        commandKey(
          replacementKey,
          `${current.supportPlanId}:${current.version}:${draft.supportPlanId}:${draft.version}`,
        ),
      ),
    onSuccess: () => {
      void recoverAuthority({
        successMessage:
          'Đã thay thế kế hoạch. Kế hoạch trước vẫn có trong lịch sử.',
        onRecovered: () => {
          replacementKey.current = null
        },
      })
    },
    onError: handleMutationError,
  })

  const busy =
    authorityRecovery !== 'idle' ||
    occurrenceAuthorityMismatch ||
    choiceMutation.isPending ||
    scheduleMutation.isPending ||
    activationMutation.isPending ||
    statusMutation.isPending ||
    occurrenceMutation.isPending ||
    proposalReviewMutation.isPending ||
    proposalDecisionMutation.isPending ||
    replacementMutation.isPending

  if (!subject) {
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Kế hoạch hỗ trợ
        </Text>
        <StateMessage
          notice={{
            message:
              'Bạn cần đăng nhập bằng tài khoản cá nhân để xem kế hoạch.',
            tone: 'error',
          }}
        />
        <PrimaryButton label="Đăng nhập lại" onPress={() => void signOut()} />
      </Screen>
    )
  }

  if (currentQuery.isPending || draftQuery.isPending) {
    return (
      <Screen>
        <View accessibilityLiveRegion="polite" style={styles.centeredState}>
          <ActivityIndicator
            accessibilityLabel="Đang tải kế hoạch hỗ trợ"
            color={colors.tealDeep}
            size="large"
          />
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Đang tải kế hoạch hỗ trợ
          </Text>
        </View>
      </Screen>
    )
  }

  const primaryError = currentQuery.error ?? draftQuery.error
  if (primaryError && !currentQuery.data && !draftQuery.data) {
    const unauthorized =
      primaryError instanceof ApiError && primaryError.status === 401
    return (
      <Screen>
        <Text style={styles.eyebrow}>CHĂM SÓC BẢN THÂN</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Kế hoạch hỗ trợ
        </Text>
        <StateMessage
          notice={{ message: loadErrorMessage(primaryError), tone: 'error' }}
        />
        <PrimaryButton
          label={unauthorized ? 'Đăng nhập lại' : 'Thử lại'}
          onPress={() => {
            if (unauthorized) void signOut()
            else void refreshAuthority()
          }}
        />
      </Screen>
    )
  }

  const current = currentQuery.data
  const draft = draftQuery.data
  const activePlan = current ?? draft
  const homeReturned =
    homeOrigin.state === 'valid'
      ? resolveLegacyHomePlanOrigin(
          current,
          currentActionsQuery.data,
          occurrenceQuery.data,
          homeOrigin.value,
        )
      : null
  const visibleOccurrences =
    occurrenceQuery.data?.occurrences.filter((item) => !item.hidden) ?? []
  const orderedOccurrences = homeReturned
    ? [
        homeReturned,
        ...visibleOccurrences.filter(
          (item) => item.occurrenceId !== homeReturned.occurrenceId,
        ),
      ]
    : visibleOccurrences
  const replacementAuthorityMatchesPlans = Boolean(
    current &&
    draft &&
    replacementQuery.data &&
    replacementQuery.data.currentPlan.supportPlanId === current.supportPlanId &&
    replacementQuery.data.currentPlan.version === current.version &&
    replacementQuery.data.proposedPlan.supportPlanId === draft.supportPlanId &&
    replacementQuery.data.proposedPlan.version === draft.version,
  )
  const replaceEligible =
    replacementAuthorityMatchesPlans &&
    replacementQuery.isSuccess &&
    !replacementQuery.isFetching &&
    replacementQuery.data?.rationaleCodes.includes('PROPOSED_PLAN_ADMISSIBLE')

  return (
    <Screen scrollRef={scrollRef} contentRef={contentRef}>
      <SecondaryButton label="← Quay lại" onPress={() => router.back()} />
      <Text style={styles.eyebrow}>CHĂM SÓC BẢN THÂN</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Kế hoạch hỗ trợ
      </Text>
      <Text style={styles.description}>
        Xem hoạt động tiếp theo, ghi nhận trải nghiệm của bạn và chỉ thay đổi kế
        hoạch sau khi MentalBridge xác nhận.
      </Text>

      {notice && <StateMessage notice={notice} />}
      <SupportPlanPersonalizationCard
        api={api}
        subject={subject}
        onReviewPlan={() =>
          setNotice({
            message:
              'Kế hoạch hiện tại ở ngay bên dưới và chưa bị thay đổi bởi lựa chọn mới.',
            tone: 'success',
          })
        }
      />
      {nativeProposalEntry}
      {authorityRecovery === 'refreshing' && (
        <Text accessibilityLiveRegion="polite" style={styles.supportingText}>
          Đang tải lại trạng thái có thẩm quyền…
        </Text>
      )}
      {authorityRecovery === 'blocked' && (
        <View style={styles.partialError}>
          <SecondaryButton
            label="Tải lại trạng thái an toàn"
            onPress={() => void recoverAuthority()}
          />
        </View>
      )}

      {proposalId && !proposalQuery.isPending && !proposalQuery.isError && (
        <ProposalCard
          busy={busy}
          request={proposalQuery.data}
          onReview={() =>
            runGovernedMutation(() => proposalReviewMutation.mutate(proposalId))
          }
          onDecision={(decision) => {
            if (proposalQuery.data) {
              runGovernedMutation(() =>
                proposalDecisionMutation.mutate({
                  request: proposalQuery.data!,
                  decision,
                }),
              )
            }
          }}
        />
      )}
      {proposalQuery.isError && (
        <StateMessage
          notice={{
            message:
              'Chưa thể tải đề xuất này. Kế hoạch hiện tại không bị thay đổi.',
            tone: 'error',
          }}
        />
      )}

      {!activePlan && (
        <View style={styles.emptyPanel}>
          <Text style={styles.sectionTitle}>Chưa có kế hoạch hỗ trợ</Text>
          <Text style={styles.body}>
            Hoàn tất hành trình sàng lọc và gợi ý hỗ trợ để có lựa chọn phù hợp
            với quyền lợi hiện tại.
          </Text>
          <PrimaryButton
            label="Đi đến sàng lọc"
            onPress={() => router.push('./assessment')}
          />
        </View>
      )}

      {current && (
        <PlanCard
          {...(currentProfessionalAction
            ? {
                professionalAction: currentProfessionalAction,
                appointment: latestAppointmentFor(
                  currentProfessionalAction,
                  currentAppointmentQuery.data,
                ),
              }
            : {})}
          busy={busy}
          canActivate={false}
          appointmentUnavailable={Boolean(
            currentProfessionalAction && currentAppointmentQuery.isError,
          )}
          professionalSupportError={currentActionsQuery.isError}
          professionalSupportRefreshing={
            currentActionsQuery.isFetching || currentAppointmentQuery.isFetching
          }
          plan={current}
          focuses={currentActionsQuery.data?.focuses}
          focusesLoading={
            currentActionsQuery.isFetching && !currentActionsQuery.data
          }
          focusesUnavailable={currentActionsQuery.isError}
          schedulePlan={currentActionsQuery.data}
          onSaveSchedule={(actionId, request, idempotencyKey) =>
            scheduleMutation
              .mutateAsync({
                plan: current,
                actionId,
                request,
                idempotencyKey,
              })
              .then(() => undefined)
          }
          onReloadSchedule={async () => {
            await recoverAuthority()
            const refreshedPlan = queryClient.getQueryData<SupportPlan | null>(
              currentKey,
            )
            const projection = queryClient.getQueryData<SupportPlanActions>(
              actionsKeyFor(current.supportPlanId),
            )
            return refreshedPlan &&
              projection?.supportPlanId === refreshedPlan.supportPlanId &&
              projection.version === refreshedPlan.version &&
              projection.status === refreshedPlan.status
              ? projection
              : undefined
          }}
          title="Kế hoạch hiện tại"
          onActivate={() => undefined}
          onChangeChoice={() => undefined}
          onRetryProfessionalSupport={() => {
            void currentActionsQuery.refetch()
            if (currentProfessionalAction)
              void currentAppointmentQuery.refetch()
          }}
          onStatus={(status) =>
            runGovernedMutation(() =>
              statusMutation.mutate({ plan: current, status }),
            )
          }
        />
      )}
      {draft && (
        <PlanCard
          {...(draftProfessionalAction
            ? {
                professionalAction: draftProfessionalAction,
                appointment: latestAppointmentFor(
                  draftProfessionalAction,
                  draftAppointmentQuery.data,
                ),
              }
            : {})}
          busy={busy}
          canActivate={!current}
          appointmentUnavailable={Boolean(
            draftProfessionalAction && draftAppointmentQuery.isError,
          )}
          professionalSupportError={draftActionsQuery.isError}
          professionalSupportRefreshing={
            draftActionsQuery.isFetching || draftAppointmentQuery.isFetching
          }
          plan={draft}
          focuses={draftActionsQuery.data?.focuses}
          focusesLoading={
            draftActionsQuery.isFetching && !draftActionsQuery.data
          }
          focusesUnavailable={draftActionsQuery.isError}
          schedulePlan={draftActionsQuery.data}
          onSaveSchedule={(actionId, request, idempotencyKey) =>
            scheduleMutation
              .mutateAsync({
                plan: draft,
                actionId,
                request,
                idempotencyKey,
              })
              .then(() => undefined)
          }
          onReloadSchedule={async () => {
            await recoverAuthority()
            const refreshedPlan = queryClient.getQueryData<SupportPlan | null>(
              draftKey,
            )
            const projection = queryClient.getQueryData<SupportPlanActions>(
              actionsKeyFor(draft.supportPlanId),
            )
            return refreshedPlan &&
              projection?.supportPlanId === refreshedPlan.supportPlanId &&
              projection.version === refreshedPlan.version &&
              projection.status === refreshedPlan.status
              ? projection
              : undefined
          }}
          title={current ? 'Phương án thay thế' : 'Kế hoạch đề xuất'}
          onActivate={() =>
            runGovernedMutation(() => activationMutation.mutate(draft))
          }
          onChangeChoice={(slotId, resourceId) =>
            runGovernedMutation(() =>
              choiceMutation.mutate({ plan: draft, slotId, resourceId }),
            )
          }
          onRetryProfessionalSupport={() => {
            void draftActionsQuery.refetch()
            if (draftProfessionalAction) void draftAppointmentQuery.refetch()
          }}
          onStatus={(status) =>
            runGovernedMutation(() =>
              statusMutation.mutate({ plan: draft, status }),
            )
          }
        />
      )}

      {current && draft && replacementQuery.isPending && (
        <Text accessibilityLiveRegion="polite" style={styles.supportingText}>
          Đang kiểm tra phương án thay thế…
        </Text>
      )}
      {replaceEligible && replacementQuery.data && (
        <View style={styles.replacePanel}>
          <Text style={styles.sectionTitle}>Thay kế hoạch hiện tại?</Text>
          <Text style={styles.body}>
            Phương án mới đã được kiểm tra với trạng thái hiện tại. Kế hoạch cũ
            sẽ được lưu trong lịch sử.
          </Text>
          <PrimaryButton
            disabled={busy}
            label="Dùng phương án mới"
            onPress={() =>
              runGovernedMutation(() =>
                replacementMutation.mutate({
                  current: current!,
                  draft: draft!,
                  review: replacementQuery.data!,
                }),
              )
            }
          />
        </View>
      )}
      {current && draft && replacementQuery.isError && (
        <StateMessage
          notice={{
            message:
              'Chưa thể xác nhận phương án thay thế. Kế hoạch hiện tại vẫn được giữ nguyên.',
            tone: 'error',
          }}
        />
      )}

      {current &&
        (current.status === 'ACTIVE' || current.status === 'PAUSED') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Hoạt động gần đây và sắp tới
            </Text>
            {occurrenceAuthorityMismatch && (
              <View style={styles.partialError}>
                <StateMessage
                  notice={{
                    message:
                      'Hoạt động vừa thay đổi theo kế hoạch mới. Hãy tải lại trạng thái trước khi ghi nhận.',
                    tone: 'error',
                  }}
                />
                <SecondaryButton
                  label="Tải lại hoạt động an toàn"
                  onPress={() => void recoverAuthority()}
                />
              </View>
            )}
            {(homeOrigin.state === 'invalid' ||
              (homeOrigin.state === 'valid' &&
                !currentActionsQuery.isPending &&
                !occurrenceQuery.isPending &&
                !homeReturned)) && (
              <View style={styles.partialError}>
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.supportingText}
                >
                  Hoạt động đã thay đổi hoặc không còn trong kế hoạch hiện tại.
                  Các mục bên dưới vẫn giữ nguyên.
                </Text>
                <SecondaryButton
                  label="Tải lại hoạt động"
                  onPress={() => {
                    void currentActionsQuery.refetch()
                    void occurrenceQuery.refetch()
                  }}
                />
              </View>
            )}
            {!occurrenceAuthorityMismatch && occurrenceQuery.isPending && (
              <Text
                accessibilityLiveRegion="polite"
                style={styles.supportingText}
              >
                Đang tải hoạt động…
              </Text>
            )}
            {!occurrenceAuthorityMismatch && occurrenceQuery.isError && (
              <View style={styles.partialError}>
                <StateMessage
                  notice={{
                    message:
                      'Chưa thể tải hoạt động. Trạng thái kế hoạch vẫn được giữ nguyên.',
                    tone: 'error',
                  }}
                />
                <SecondaryButton
                  label="Thử tải lại hoạt động"
                  onPress={() => void occurrenceQuery.refetch()}
                />
              </View>
            )}
            {!occurrenceAuthorityMismatch &&
              orderedOccurrences.length === 0 && (
                <Text style={styles.supportingText}>
                  Chưa có hoạt động trong khoảng thời gian này.
                </Text>
              )}
            {!occurrenceAuthorityMismatch &&
              orderedOccurrences.map((occurrence) => (
                <OccurrenceCard
                  busy={busy}
                  canEdit={current.status === 'ACTIVE'}
                  key={`${occurrence.occurrenceId}:${occurrence.version}`}
                  occurrence={occurrence}
                  onReturnLayout={focusReturnedActivity}
                  returnedFromHome={
                    homeReturned?.occurrenceId === occurrence.occurrenceId
                  }
                  onSave={(engagement) =>
                    runGovernedMutation(() =>
                      occurrenceMutation.mutate({ occurrence, engagement }),
                    )
                  }
                />
              ))}
          </View>
        )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Kế hoạch trước đây</Text>
        {historyQuery.isError && (
          <StateMessage
            notice={{
              message:
                'Chưa thể tải lịch sử. Kế hoạch hiện tại vẫn có thể sử dụng.',
              tone: 'error',
            }}
          />
        )}
        {historyQuery.data?.items.length === 0 && (
          <Text style={styles.supportingText}>
            Bạn chưa có kế hoạch đã kết thúc hoặc được thay thế.
          </Text>
        )}
        {historyQuery.data?.items.map((item) => (
          <View key={item.supportPlanId} style={styles.historyRow}>
            <Text style={styles.itemTitle}>{statusLabels[item.status]}</Text>
            <Text style={styles.supportingText}>
              Cập nhật {formatDate(item.updatedAt)}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    fontWeight: '700',
    lineHeight: typography.headingLineHeight,
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.xl,
  },
  centeredState: { alignItems: 'center', gap: spacing.md },
  notice: {
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.lg,
  },
  errorText: { color: '#9B352D' },
  successText: { color: colors.tealDeep },
  body: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  supportingText: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  itemTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  planPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.shell,
    gap: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.xl,
  },
  emptyPanel: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.shell,
    gap: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.xl,
  },
  proposalPanel: {
    backgroundColor: '#F8E8DF',
    borderRadius: radii.panel,
    gap: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.xl,
  },
  professionalPanel: {
    backgroundColor: colors.tealPale,
    borderColor: colors.tealDeep,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  professionalEyebrow: {
    color: colors.tealDeep,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1,
  },
  focusPanel: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  focusItem: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  focusHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  focusLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  personalizedBadge: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  replacePanel: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.panel,
    gap: spacing.lg,
    marginBottom: spacing.xl,
    padding: spacing.xl,
  },
  resourceGroup: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  choiceList: { gap: spacing.sm, marginTop: spacing.sm },
  choice: {
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  choiceSelected: {
    backgroundColor: colors.tealPale,
    borderColor: colors.tealDeep,
  },
  choiceLabel: { color: colors.ink, fontSize: typography.body },
  actions: { alignItems: 'flex-start', gap: spacing.sm },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderColor: colors.tealDeep,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryLabel: { color: colors.tealDeep, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.68 },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  safetyText: {
    color: '#8A352C',
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: typography.bodyLineHeight,
  },
  disclaimer: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  section: { gap: spacing.md, marginTop: spacing.xl },
  occurrencePanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    gap: spacing.md,
    padding: spacing.lg,
  },
  reflectionField: { gap: spacing.sm },
  input: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 88,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  partialError: { gap: spacing.sm },
  historyRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
})
