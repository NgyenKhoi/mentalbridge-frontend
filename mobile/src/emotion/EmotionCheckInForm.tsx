import { useState, type ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated from 'react-native-reanimated'

import { useRevealProps } from '@/components/motion'
import { PressableScale } from '@/components/PressableScale'
import { dashboardColors, Txt } from '@/theme/dashboard'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import { emotions, influenceFactors, type Draft } from './emotion-presentation'

/**
 * 'screen' keeps every field visible on the emotion screen; 'card' is the compact
 * home variant: one row of faces, the rest reveals after the first choice.
 */
export function EmotionCheckInForm({
  draft,
  onChange,
  onSave,
  saving,
  saveDisabled,
  saveLabel,
  variant = 'screen',
  unsaved = false,
  footer,
}: Readonly<{
  draft: Draft
  onChange: (update: (draft: Draft) => Draft) => void
  onSave: () => void
  saving: boolean
  saveDisabled: boolean
  saveLabel: string
  variant?: 'screen' | 'card'
  unsaved?: boolean
  footer?: ReactNode
}>) {
  const card = variant === 'card'
  const styles = card ? cardStyles : screenStyles
  const reveal = useRevealProps()
  const { width, fontScale } = useWindowDimensions()
  const [contextExpanded, setContextExpanded] = useState(false)
  const wrapFaces = card && (width < 380 || fontScale > 1.25)
  const showRest = !card || draft.emotion !== null
  const Label = card ? Txt : Text

  return (
    <>
      <View
        accessibilityRole="radiogroup"
        style={[styles.choiceGrid, card && !wrapFaces && styles.choiceGridRow]}
      >
        {emotions.map((item) => {
          const selected = draft.emotion === item.value
          return (
            <PressableScale
              key={item.value}
              accessibilityLabel={item.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              disabled={saving}
              onPress={() =>
                onChange((value) => ({ ...value, emotion: item.value }))
              }
              style={[
                styles.choice,
                card && (wrapFaces ? styles.choiceWrapped : styles.choiceRow),
                selected && styles.choiceSelected,
                saving && styles.dim,
              ]}
            >
              <Text accessible={false} style={styles.emoji}>
                {item.emoji}
              </Text>
              <Label
                style={[
                  styles.choiceLabel,
                  card && !wrapFaces && styles.choiceLabelRow,
                ]}
              >
                {item.label}
              </Label>
            </PressableScale>
          )
        })}
      </View>

      {showRest && (
        <Animated.View {...(card ? reveal : {})} style={styles.rest}>
          <Label style={styles.fieldLabel}>Mức độ cảm nhận</Label>
          <Label style={styles.supporting}>
            1 là nhẹ, 5 là mạnh — không phải điểm sức khỏe.
          </Label>
          <View accessibilityRole="radiogroup" style={styles.intensityRow}>
            {[1, 2, 3, 4, 5].map((intensity) => {
              const selected = draft.intensity === intensity
              return (
                <PressableScale
                  key={intensity}
                  accessibilityLabel={`Mức cảm nhận ${intensity}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  disabled={saving}
                  onPress={() => onChange((value) => ({ ...value, intensity }))}
                  style={[
                    styles.intensity,
                    selected && styles.intensitySelected,
                    saving && styles.dim,
                  ]}
                >
                  <Label
                    style={[
                      styles.intensityLabel,
                      selected && styles.intensityLabelSelected,
                    ]}
                  >
                    {intensity}
                  </Label>
                </PressableScale>
              )
            })}
          </View>
          <Pressable
            accessibilityLabel="Thêm bối cảnh riêng tư (không bắt buộc)"
            accessibilityRole="button"
            accessibilityState={{ expanded: contextExpanded }}
            onPress={() => setContextExpanded((value) => !value)}
            style={({ pressed }) => [
              styles.contextToggle,
              pressed && styles.pressed,
            ]}
          >
            <Label style={styles.contextToggleLabel}>
              Thêm bối cảnh riêng tư (không bắt buộc)
            </Label>
            <Text accessible={false} style={styles.contextToggleIcon}>
              {contextExpanded ? '−' : '+'}
            </Text>
          </Pressable>
          {contextExpanded && (
            <Animated.View {...reveal} style={styles.contextBody}>
              <Label style={styles.contextPrivacy}>
                Chỉ lưu khi bạn chọn “Lưu ghi nhận”. Nội dung này giúp bạn xem
                lại và không tự động gửi cho AI, kế hoạch hỗ trợ hay phân tích.
              </Label>
              <Label style={styles.fieldLabel}>
                Điều gì có thể ảnh hưởng đến cảm xúc này?
              </Label>
              <Label style={styles.supporting}>Có thể chọn tối đa 3 mục.</Label>
              <View style={styles.factorGrid}>
                {influenceFactors.map((factor) => {
                  const selected = draft.factors.includes(factor.value)
                  const disabled =
                    saving || (!selected && draft.factors.length >= 3)
                  return (
                    <Pressable
                      key={factor.value}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled }}
                      disabled={disabled}
                      onPress={() =>
                        onChange((currentDraft) => ({
                          ...currentDraft,
                          factors: selected
                            ? currentDraft.factors.filter(
                                (value) => value !== factor.value,
                              )
                            : influenceFactors
                                .filter(
                                  ({ value }) =>
                                    currentDraft.factors.includes(value) ||
                                    value === factor.value,
                                )
                                .map(({ value }) => value),
                        }))
                      }
                      style={({ pressed }) => [
                        styles.factorChip,
                        selected && styles.factorSelected,
                        disabled && styles.dim,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Label
                        style={[
                          styles.factorLabel,
                          selected && styles.factorLabelSelected,
                        ]}
                      >
                        {factor.label}
                      </Label>
                    </Pressable>
                  )
                })}
              </View>
              <Label style={styles.fieldLabel}>
                Ghi chú riêng (không bắt buộc)
              </Label>
              <TextInput
                accessibilityLabel="Ghi chú riêng (không bắt buộc)"
                editable={!saving}
                maxLength={500}
                multiline
                onChangeText={(note) =>
                  onChange((currentDraft) => ({ ...currentDraft, note }))
                }
                placeholder="Bạn có thể để trống"
                placeholderTextColor={
                  card ? dashboardColors.inkFaint : undefined
                }
                style={styles.noteInput}
                textAlignVertical="top"
                value={draft.note}
              />
              <Label style={styles.noteCount}>{draft.note.length}/500</Label>
            </Animated.View>
          )}
          {unsaved && (
            <Label style={styles.supporting}>Lựa chọn này chưa được lưu.</Label>
          )}
          <View style={styles.actions}>
            <PressableScale
              accessibilityRole="button"
              accessibilityState={{ disabled: saveDisabled }}
              disabled={saveDisabled}
              onPress={onSave}
              scaleTo={0.97}
              style={[styles.save, saveDisabled && styles.dim]}
            >
              <Label style={styles.saveLabel}>
                {saving ? 'Đang lưu…' : saveLabel}
              </Label>
            </PressableScale>
            {footer}
          </View>
        </Animated.View>
      )}
    </>
  )
}

const createStyles = (c: typeof colors | typeof dashboardColors) =>
  StyleSheet.create({
    choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    choiceGridRow: { flexWrap: 'nowrap', gap: spacing.xs },
    choice: {
      alignItems: 'center',
      backgroundColor: c.surfaceSoft,
      borderColor: 'transparent',
      borderRadius: radii.control,
      borderWidth: 2,
      justifyContent: 'center',
      minHeight: 78,
      minWidth: 88,
      padding: spacing.sm,
    },
    choiceRow: { flex: 1, minWidth: 0, padding: spacing.xs },
    choiceLabelRow: { fontSize: 13 },
    choiceWrapped: { flexBasis: '30%', flexGrow: 1, minWidth: 0 },
    choiceSelected: { backgroundColor: c.tealPale, borderColor: c.tealDeep },
    emoji: { fontSize: 24 },
    choiceLabel: {
      color: c.ink,
      fontSize: 14,
      fontWeight: '700',
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    rest: { gap: spacing.md },
    fieldLabel: {
      color: c.ink,
      fontSize: typography.body,
      fontWeight: '700',
      marginTop: spacing.sm,
    },
    supporting: {
      color: c.inkSoft,
      fontSize: typography.body,
      lineHeight: typography.bodyLineHeight,
    },
    intensityRow: { flexDirection: 'row', gap: spacing.sm },
    intensity: {
      alignItems: 'center',
      backgroundColor: c.surfaceSoft,
      borderColor: 'transparent',
      borderRadius: radii.control,
      borderWidth: 2,
      justifyContent: 'center',
      minHeight: 48,
      minWidth: 48,
    },
    intensitySelected: { backgroundColor: c.tealDeep, borderColor: c.tealDeep },
    intensityLabel: {
      color: c.ink,
      fontSize: typography.body,
      fontWeight: '700',
    },
    intensityLabelSelected: { color: c.white },
    contextToggle: {
      alignItems: 'center',
      borderTopColor: c.line,
      borderTopWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 48,
      marginTop: spacing.sm,
      paddingTop: spacing.md,
    },
    contextToggleLabel: {
      color: c.tealDeep,
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
    },
    contextToggleIcon: {
      color: c.tealDeep,
      fontSize: 22,
      fontWeight: '700',
      marginLeft: spacing.md,
    },
    contextBody: { gap: spacing.md },
    contextPrivacy: { color: c.inkSoft, fontSize: 14, lineHeight: 21 },
    factorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    factorChip: {
      alignItems: 'center',
      backgroundColor: c.surfaceSoft,
      borderColor: c.line,
      borderRadius: radii.pill,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: spacing.lg,
    },
    factorSelected: { backgroundColor: c.tealPale, borderColor: c.tealDeep },
    factorLabel: { color: c.ink, fontSize: 14, fontWeight: '700' },
    factorLabelSelected: { color: c.tealDeep },
    noteInput: {
      borderColor: c.line,
      borderRadius: radii.control,
      borderWidth: 1,
      color: c.ink,
      fontSize: typography.body,
      minHeight: 96,
      padding: spacing.md,
    },
    noteCount: { alignSelf: 'flex-end', color: c.inkSoft, fontSize: 12 },
    actions: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    save: {
      alignItems: 'center',
      backgroundColor: c.tealDeep,
      borderRadius: radii.control,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    saveLabel: {
      color: c.white,
      fontSize: typography.body,
      fontWeight: '700',
    },
    dim: { opacity: 0.5 },
    pressed: { opacity: 0.7 },
  })

const screenStyles = createStyles(colors)
const cardStyles = createStyles(dashboardColors)
