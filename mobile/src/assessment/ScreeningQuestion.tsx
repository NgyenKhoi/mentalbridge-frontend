import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useResourceFonts } from '@/resources/useResourceFonts'
import { colors, radii, spacing } from '@/theme/tokens'

import type { Questionnaire } from './assessment-contract'

export function ScreeningQuestion({
  questionnaire,
  step,
  selected,
  busy,
  onSelect,
}: Readonly<{
  questionnaire: Questionnaire
  step: number
  selected: number | undefined
  busy: boolean
  onSelect: (value: number) => void
}>) {
  const fonts = useResourceFonts()
  const question = questionnaire.questions[step]!
  const count = questionnaire.questions.length
  const position = step + 1

  return (
    <View style={s.card}>
      <View style={s.metadata}>
        <Text style={s.badge}>
          {questionnaire.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'}
        </Text>
        <Text accessibilityLiveRegion="polite" style={s.caption}>
          Câu {position} / {count}
        </Text>
      </View>
      <View
        accessibilityLabel="Tiến độ bài sàng lọc"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: count, now: position }}
        style={s.track}
      >
        <View style={[s.fill, { width: `${(position / count) * 100}%` }]} />
      </View>
      <Text accessibilityRole="header" style={[s.prompt, fonts && s.serif]}>
        {question.prompt}
      </Text>
      <Text style={s.caption}>
        Chọn theo trải nghiệm của bạn trong {questionnaire.referencePeriodDays}{' '}
        ngày gần đây.
      </Text>
      <View accessibilityRole="radiogroup" style={s.answers}>
        {questionnaire.responseOptions.map(({ value, label }) => {
          const checked = value === selected
          return (
            <Pressable
              key={value}
              accessibilityLabel={label}
              accessibilityRole="radio"
              accessibilityState={{ checked, disabled: busy }}
              disabled={busy}
              onPress={() => onSelect(value)}
              style={({ pressed }) => [
                s.option,
                checked && s.selected,
                pressed && s.pressed,
              ]}
            >
              <View aria-hidden style={[s.radio, checked && s.radioChecked]}>
                {checked && <View style={s.dot} />}
              </View>
              <Text style={[s.label, checked && s.selectedLabel]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.shell,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    overflow: 'hidden',
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
    color: colors.tealDeep,
    fontWeight: '800',
  },
  caption: { color: colors.inkSoft, fontSize: 14, lineHeight: 21 },
  track: {
    height: 7,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSoft,
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.teal,
  },
  prompt: {
    color: colors.ink,
    fontSize: 25,
    lineHeight: 33,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  serif: { fontFamily: 'ResourceSerif', fontWeight: 'normal' },
  answers: { gap: spacing.sm, marginTop: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.md,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.line,
  },
  selected: { borderColor: colors.teal, backgroundColor: colors.tealPale },
  pressed: { opacity: 0.72 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioChecked: { borderColor: colors.tealDeep },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.tealDeep,
  },
  label: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 22 },
  selectedLabel: { fontWeight: '700', color: colors.tealDeep },
})
