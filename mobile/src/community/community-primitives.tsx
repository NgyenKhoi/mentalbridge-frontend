import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { onlineManager } from '@tanstack/react-query'
import {
  useEffect,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { useRevealProps, useStaggerProps } from '@/components/motion'
import { PressableScale } from '@/components/PressableScale'
import { Txt } from '@/theme/dashboard'
import { radii, spacing } from '@/theme/tokens'

import { communityColors } from './community-theme'

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name']

/** Decorative glyph: hidden from the screen reader, the control or text beside it carries the label. */
export function CommunityIcon({
  name,
  size = 22,
  color = communityColors.primaryDeep,
}: Readonly<{ name: IconName; size?: number; color?: string }>) {
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  )
}

export const communityText = StyleSheet.create({
  section: {
    color: communityColors.ink,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
  },
  author: {
    color: communityColors.ink,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: '700',
  },
  body: { color: communityColors.ink, fontSize: 16, lineHeight: 24 },
  meta: { color: communityColors.inkSoft, fontSize: 13, lineHeight: 18 },
})

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'

export function CommunityButton({
  label,
  onPress,
  disabled = false,
  selected,
  testID,
  variant = 'secondary',
  icon,
  accessibilityLabel,
  large = false,
}: Readonly<{
  label: string
  onPress: () => void
  disabled?: boolean
  selected?: boolean
  testID?: string
  variant?: ButtonVariant
  icon?: IconName
  accessibilityLabel?: string
  /** Sticky form action: 50 dp high, radius 14. */
  large?: boolean
}>) {
  const tint =
    variant === 'primary'
      ? communityColors.white
      : variant === 'danger'
        ? communityColors.danger
        : communityColors.primaryDeep
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{
        disabled,
        ...(selected === undefined ? {} : { selected }),
      }}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
      style={[
        button.base,
        large && button.large,
        variant === 'primary' && button.primary,
        variant === 'secondary' && button.secondary,
        (variant === 'quiet' || variant === 'danger') && button.quiet,
        selected && variant === 'secondary' && button.selected,
        disabled && button.disabled,
      ]}
    >
      {icon && <CommunityIcon name={icon} size={20} color={tint} />}
      <Txt style={[button.label, { color: tint }]}>{label}</Txt>
    </PressableScale>
  )
}

const button = StyleSheet.create({
  base: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.control,
  },
  large: { borderRadius: 14, minHeight: 50 },
  primary: { backgroundColor: communityColors.primaryDeep },
  secondary: { borderWidth: 1, borderColor: communityColors.primaryDeep },
  quiet: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  selected: { backgroundColor: communityColors.mint },
  disabled: { opacity: 0.55 },
  label: { fontSize: 16, lineHeight: 22, fontWeight: '600', flexShrink: 1 },
})

/** 40 dp round button with a 48 dp hit area. */
export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  selected,
  expanded,
  filled = false,
  testID,
  children,
}: Readonly<{
  icon?: IconName
  label: string
  onPress: () => void
  disabled?: boolean
  selected?: boolean
  expanded?: boolean
  filled?: boolean
  testID?: string
  /** Replaces the glyph, for example an Avatar. */
  children?: ReactNode
}>) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled,
        ...(selected === undefined ? {} : { selected }),
        ...(expanded === undefined ? {} : { expanded }),
      }}
      disabled={disabled}
      hitSlop={4}
      testID={testID}
      onPress={onPress}
      scaleTo={0.9}
      style={[
        iconButton.base,
        selected && iconButton.selected,
        filled && iconButton.filled,
        disabled && button.disabled,
      ]}
    >
      {children ??
        (icon && (
          <CommunityIcon
            name={icon}
            size={24}
            color={filled ? communityColors.white : communityColors.ink}
          />
        ))}
    </PressableScale>
  )
}

const iconButton = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: radii.pill,
  },
  selected: { backgroundColor: communityColors.soft },
  filled: { backgroundColor: communityColors.primaryDeep },
})

/** `large` is the feed-level title (21/800), `compact` the sub-screen one (17/700). */
export function CommunityHeader({
  title,
  backLabel,
  onBack,
  right,
  size = 'compact',
  padded = false,
}: Readonly<{
  title: string
  backLabel?: string
  onBack?: () => void
  right?: ReactNode
  size?: 'large' | 'compact'
  /** Edge-to-edge screens inset the bar themselves. */
  padded?: boolean
}>) {
  return (
    <View style={[header.row, padded && header.padded]}>
      {onBack && backLabel && (
        <IconButton icon="arrow-left" label={backLabel} onPress={onBack} />
      )}
      <Txt
        accessibilityRole="header"
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        numberOfLines={1}
        style={[header.title, size === 'large' ? header.large : header.compact]}
      >
        {title}
      </Txt>
      {right && <View style={header.right}>{right}</View>}
    </View>
  )
}

const header = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  padded: {
    backgroundColor: communityColors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: { flex: 1, flexShrink: 1, color: communityColors.ink },
  large: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    paddingLeft: spacing.xs,
  },
  compact: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  right: { alignItems: 'center', flexDirection: 'row' },
})

function ChipFace({
  label,
  icon,
  color,
}: Readonly<{ label: string; icon: IconName | undefined; color: string }>) {
  return (
    <>
      {icon && <CommunityIcon name={icon} size={18} color={color} />}
      <Txt numberOfLines={1} style={[chip.label, { color }]}>
        {label}
      </Txt>
    </>
  )
}

/** Soft pill; selected is a primaryDeep fill that cross-fades in with white text. */
export function Chip({
  label,
  onPress,
  selected = false,
  disabled = false,
  icon,
  testID,
}: Readonly<{
  label: string
  onPress: () => void
  selected?: boolean
  disabled?: boolean
  icon?: IconName
  testID?: string
}>) {
  const reduceMotion = useReducedMotion()
  const fill = useSharedValue(selected ? 1 : 0)
  useEffect(() => {
    const next = selected ? 1 : 0
    fill.set(reduceMotion ? next : withTiming(next, { duration: 160 }))
  }, [selected, reduceMotion, fill])
  // The white face is a second layer faded in as opacity: no colour animation.
  const face = useAnimatedStyle(() => ({ opacity: fill.value }))
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      hitSlop={{ top: 5, bottom: 5 }}
      scaleTo={0.95}
      testID={testID}
      onPress={onPress}
      style={[chip.base, disabled && button.disabled]}
    >
      <ChipFace label={label} icon={icon} color={communityColors.ink} />
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[chip.face, face]}
      >
        <ChipFace label={label} icon={icon} color={communityColors.white} />
      </Animated.View>
    </PressableScale>
  )
}

const chip = StyleSheet.create({
  base: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: radii.pill,
    flexDirection: 'row',
    flexShrink: 0,
    gap: spacing.xs,
    height: 34,
    overflow: 'hidden',
    paddingHorizontal: 14,
  },
  face: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: communityColors.primaryDeep,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: 14,
  },
  label: { fontSize: 13.5, lineHeight: 20, fontWeight: '500' },
})

/** Full-width tappable row with a leading glyph (sheet menus, safety actions). */
export function ActionRow({
  label,
  icon,
  onPress,
  disabled = false,
  danger = false,
  testID,
}: Readonly<{
  label: string
  icon: IconName
  onPress: () => void
  disabled?: boolean
  danger?: boolean
  testID?: string
}>) {
  const tint = danger ? communityColors.danger : communityColors.ink
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      scaleTo={0.98}
      testID={testID}
      onPress={onPress}
      style={[row.base, disabled && button.disabled]}
    >
      <CommunityIcon name={icon} color={tint} />
      <Txt style={[communityText.body, { color: tint }]}>{label}</Txt>
    </PressableScale>
  )
}

/** Whole row is one single-select radio item. */
export function ChoiceRow({
  label,
  selected,
  onPress,
  disabled = false,
}: Readonly<{
  label: string
  selected: boolean
  onPress: () => void
  disabled?: boolean
}>) {
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      scaleTo={0.98}
      onPress={onPress}
      style={[row.base, disabled && button.disabled]}
    >
      <CommunityIcon
        name={selected ? 'radiobox-marked' : 'radiobox-blank'}
        color={selected ? communityColors.primaryDeep : communityColors.inkSoft}
      />
      <Txt style={[communityText.body, selected && { fontWeight: '600' }]}>
        {label}
      </Txt>
    </PressableScale>
  )
}

const row = StyleSheet.create({
  base: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
})

/** Whole-screen empty, error or unavailable state: one glyph, a title, one line, one action. */
export function StateCard({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  tone = 'neutral',
}: Readonly<{
  icon: IconName
  title: string
  body?: string | undefined
  actionLabel?: string
  onAction?: () => void
  tone?: 'neutral' | 'error'
}>) {
  return (
    <View
      {...(tone === 'error' ? { accessibilityLiveRegion: 'assertive' } : {})}
      style={state.card}
    >
      <View style={state.badge}>
        <CommunityIcon
          name={icon}
          color={
            tone === 'error'
              ? communityColors.danger
              : communityColors.primaryDeep
          }
        />
      </View>
      <Txt style={[communityText.section, state.title]}>{title}</Txt>
      {body ? (
        <Txt style={[communityText.body, state.title]}>{body}</Txt>
      ) : null}
      {actionLabel && onAction ? (
        <CommunityButton label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  )
}

const state = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  title: { textAlign: 'center' },
})

/** A top-level block: `step` staggers it by 40 ms per step on first mount; without `step` it rises in alone. */
export function Reveal({
  step,
  enabled = true,
  style,
  children,
}: Readonly<{
  step?: number
  enabled?: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}>) {
  const staggered = useStaggerProps(step ?? 0, enabled && step !== undefined)
  const risen = useRevealProps()
  const motion = step !== undefined ? staggered : enabled ? risen : {}
  return (
    <Animated.View {...motion} style={style}>
      {children}
    </Animated.View>
  )
}

/** Small read-only tag (role, topic). */
export function TopicPill({ label }: Readonly<{ label: string }>) {
  return (
    <View style={pill.box}>
      <Txt style={pill.text}>{label}</Txt>
    </View>
  )
}

const pill = StyleSheet.create({
  box: {
    backgroundColor: communityColors.soft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: { color: communityColors.primaryDeep, fontSize: 13, lineHeight: 18 },
})

/** 8 dp strip between edge-to-edge sections. */
export function Band() {
  return <View style={band.strip} />
}

const band = StyleSheet.create({
  strip: { backgroundColor: communityColors.soft, height: 8 },
})

export function useIsOnline() {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
  )
}

export function OfflineBanner({
  inset = false,
}: Readonly<{ inset?: boolean }>) {
  if (useIsOnline()) return null
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[banner.row, inset && banner.inset]}
    >
      <CommunityIcon
        name="wifi-off"
        size={20}
        color={communityColors.inkSoft}
      />
      <Txt style={[communityText.meta, banner.text]}>
        Bạn đang ngoại tuyến. Nội dung sẽ cập nhật khi có mạng lại.
      </Txt>
    </View>
  )
}

const banner = StyleSheet.create({
  row: {
    alignItems: 'center',
    backgroundColor: communityColors.soft,
    borderRadius: radii.control,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  inset: { marginHorizontal: spacing.md, marginVertical: spacing.sm },
  text: { flex: 1, fontSize: 14, lineHeight: 20 },
})

/** Selected state of a row or tile: `style` cross-fades in over 160 ms (opacity only); put it first inside the pressable. */
export function SelectOverlay({
  selected,
  style,
}: Readonly<{ selected: boolean; style: StyleProp<ViewStyle> }>) {
  const reduceMotion = useReducedMotion()
  const fill = useSharedValue(selected ? 1 : 0)
  useEffect(() => {
    const next = selected ? 1 : 0
    fill.set(reduceMotion ? next : withTiming(next, { duration: 160 }))
  }, [selected, reduceMotion, fill])
  const fade = useAnimatedStyle(() => ({ opacity: fill.value }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style, fade]}
    />
  )
}
