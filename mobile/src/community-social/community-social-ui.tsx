import { useEffect, useState, type ReactNode } from 'react'
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { PressableScale } from '@/components/PressableScale'
import { Screen } from '@/components/Screen'
import { Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'
import {
  ActionRow,
  Avatar,
  BottomSheet,
  CommunityButton,
  CommunityHeader,
  CommunityIcon,
  CommunityMessage,
  communityMessage,
  communityText,
  IconButton,
  Reveal,
  SkeletonGroup,
  SkeletonRow,
  StateCard,
  useCommunityAction,
  type AvatarAuthor,
  type IconName,
} from '@/community/community-ui'
import { communityColors } from '@/community/community-theme'

export const socialKey = (subject: string, ...rest: unknown[]) =>
  ['community-social', subject, ...rest] as const

export { Reveal }

export const roleLabel = (role: 'OWNER' | 'MEMBER') =>
  role === 'OWNER' ? 'Chủ nhóm' : 'Thành viên'

// The feature flag or a dependency being off answers 403, 404 or 503.
export const isUnavailable = (error: unknown) =>
  error instanceof ApiError && [403, 404, 503].includes(error.status ?? 0)

export function useDebounced<T>(value: T, delay: number) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

/** While `active`, hardware back runs `onBack` instead of leaving the screen. */
export function useBackOverride(active: boolean, onBack: () => void) {
  useEffect(() => {
    if (!active) return
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onBack()
        return true
      },
    )
    return () => subscription.remove()
  }, [active, onBack])
}

/** Fixed header over a scrolling edge-to-edge column. */
export function SocialFrame({
  title,
  backLabel,
  onBack,
  right,
  footer,
  children,
}: Readonly<{
  title: string
  backLabel: string
  onBack: () => void
  right?: ReactNode
  footer?: ReactNode
  children: ReactNode
}>) {
  return (
    <Screen
      layout="bleed"
      backgroundColor={communityColors.background}
      header={
        <CommunityHeader
          padded
          title={title}
          backLabel={backLabel}
          onBack={onBack}
          right={right}
        />
      }
      footer={footer}
    >
      {children}
    </Screen>
  )
}

export function SocialSkeleton({
  label,
  size = 52,
  rows = 5,
}: Readonly<{ label: string; size?: number; rows?: number }>) {
  return (
    <View style={styles.pad}>
      <SkeletonGroup label={label}>
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonRow key={index} size={size} />
        ))}
      </SkeletonGroup>
    </View>
  )
}

/** Error with retry, or an honest "not available" when the server says the feature is off. */
export function LoadFailure({
  error,
  unavailableTitle,
  failureTitle,
  onRetry,
  onBack,
}: Readonly<{
  error: unknown
  unavailableTitle: string
  failureTitle: string
  onRetry: () => void
  onBack: () => void
}>) {
  return isUnavailable(error) ? (
    <StateCard
      icon="account-lock-outline"
      title={unavailableTitle}
      actionLabel="Quay lại"
      onAction={onBack}
    />
  ) : (
    <StateCard
      tone="error"
      icon="alert-circle-outline"
      title={failureTitle}
      body={communityMessage(error)}
      actionLabel="Thử lại"
      onAction={onRetry}
    />
  )
}

export function LoadMore({
  label,
  loading,
  onPress,
}: Readonly<{ label: string; loading: boolean; onPress: () => void }>) {
  return (
    <View style={styles.more}>
      <CommunityButton
        label={loading ? 'Đang tải…' : label}
        disabled={loading}
        onPress={onPress}
      />
    </View>
  )
}

/** A flat person row: the avatar and name open the member page, `trailing` sits at the end, `actions` under the name. */
export function PersonRow({
  author,
  name,
  meta,
  step,
  onOpen,
  trailing,
  actions,
}: Readonly<{
  author: AvatarAuthor
  name: string
  meta?: string | undefined
  step?: number
  onOpen?: (() => void) | undefined
  trailing?: ReactNode
  actions?: ReactNode
}>) {
  const who = (
    <>
      <Avatar author={author} size={52} />
      <View style={styles.text}>
        <Txt numberOfLines={1} style={communityText.author}>
          {name}
        </Txt>
        {meta ? (
          <Txt numberOfLines={2} style={communityText.meta}>
            {meta}
          </Txt>
        ) : null}
      </View>
    </>
  )
  return (
    <Reveal {...(step === undefined ? {} : { step })}>
      <View style={styles.person}>
        <View style={styles.personMain}>
          {onOpen ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Xem trang của ${name}`}
              scaleTo={0.98}
              onPress={onOpen}
              style={styles.who}
            >
              {who}
            </PressableScale>
          ) : (
            <View style={styles.who}>{who}</View>
          )}
          {trailing}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </Reveal>
  )
}

export function SearchField({
  value,
  label,
  placeholder,
  onChange,
}: Readonly<{
  value: string
  label: string
  placeholder: string
  onChange: (value: string) => void
}>) {
  return (
    <View style={styles.search}>
      <CommunityIcon name="magnify" size={22} color={communityColors.inkSoft} />
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={80}
        placeholder={placeholder}
        placeholderTextColor={communityColors.inkSoft}
        returnKeyType="search"
        value={value}
        onChangeText={onChange}
        style={styles.searchInput}
      />
      {value ? (
        <IconButton
          icon="close-circle"
          label="Xóa nội dung tìm kiếm"
          onPress={() => onChange('')}
        />
      ) : null}
    </View>
  )
}

/** Sticky multiline input with a send button. */
export function StickyInput({
  label,
  placeholder,
  value,
  busy,
  error,
  sendLabel,
  maxLength,
  onChange,
  onSend,
}: Readonly<{
  label: string
  placeholder: string
  value: string
  busy: boolean
  error: string | null
  sendLabel: string
  maxLength: number
  onChange: (value: string) => void
  onSend: () => void
}>) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.footer}
    >
      {error ? <CommunityMessage>{error}</CommunityMessage> : null}
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={label}
          multiline
          maxLength={maxLength}
          placeholder={placeholder}
          placeholderTextColor={communityColors.inkSoft}
          value={value}
          editable={!busy}
          onChangeText={onChange}
          style={styles.input}
        />
        <IconButton
          icon="send"
          filled
          label={busy ? 'Đang gửi…' : sendLabel}
          disabled={busy || !value.trim()}
          onPress={onSend}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

export type SheetAction = Readonly<{
  key: string
  label: string
  icon: IconName
  danger?: boolean
  run: () => Promise<void>
  /** When present the action asks first, inside the same sheet. */
  confirm?: Readonly<{ title: string; message: string; label: string }>
}>

function ActionSheetBody({
  actions,
  onClose,
}: Readonly<{ actions: readonly SheetAction[]; onClose: () => void }>) {
  const [picked, setPicked] = useState<SheetAction | null>(null)
  const action = useCommunityAction()
  const execute = (item: SheetAction) =>
    action.run(async () => {
      await item.run()
      onClose()
    })
  return (
    <>
      {picked?.confirm ? (
        <View style={styles.confirm}>
          <Txt accessibilityRole="header" style={communityText.section}>
            {picked.confirm.title}
          </Txt>
          <Txt style={communityText.body}>{picked.confirm.message}</Txt>
          <CommunityButton
            variant="quiet"
            label="Quay lại"
            disabled={action.busy}
            onPress={() => setPicked(null)}
          />
          <CommunityButton
            variant="primary"
            label={picked.confirm.label}
            disabled={action.busy}
            onPress={() => void execute(picked)}
          />
        </View>
      ) : (
        actions.map((item) => (
          <ActionRow
            key={item.key}
            icon={item.icon}
            label={item.label}
            danger={item.danger ?? false}
            disabled={action.busy}
            onPress={() =>
              item.confirm ? setPicked(item) : void execute(item)
            }
          />
        ))
      )}
      {action.error ? (
        <CommunityMessage>{action.error}</CommunityMessage>
      ) : null}
    </>
  )
}

/** Overflow menu of a row or screen; destructive actions confirm in place. Starts at the menu each time it opens. */
export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: Readonly<{
  visible: boolean
  onClose: () => void
  title: string
  actions: readonly SheetAction[]
}>) {
  const [open, setOpen] = useState(visible)
  const [epoch, setEpoch] = useState(0)
  if (visible !== open) {
    setOpen(visible)
    if (visible) setEpoch(epoch + 1)
  }
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <ActionSheetBody key={epoch} actions={actions} onClose={onClose} />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  more: { alignItems: 'center', padding: spacing.lg },
  person: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  personMain: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  who: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 60,
  },
  text: { flex: 1 },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingLeft: 52 + spacing.md,
  },
  search: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    minHeight: 46,
    paddingLeft: spacing.md,
  },
  searchInput: {
    color: communityColors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 46,
  },
  confirm: { gap: spacing.md, paddingVertical: spacing.sm },
  footer: {
    backgroundColor: communityColors.background,
    borderTopColor: communityColors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingBottom: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  inputRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  input: {
    backgroundColor: communityColors.soft,
    borderRadius: radii.control + 8,
    color: communityColors.ink,
    flex: 1,
    fontSize: 14.5,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    textAlignVertical: 'center',
  },
})
