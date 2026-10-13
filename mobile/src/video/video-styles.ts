import { StyleSheet } from 'react-native'
import { colors, radii, spacing, typography } from '@/theme/tokens'

export const videoStyles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    padding: spacing.lg,
    marginVertical: spacing.lg,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '700', color: colors.ink },
  copy: {
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    color: colors.ink,
  },
  note: {
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    color: colors.inkSoft,
  },
  error: {
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    color: colors.ink,
    borderLeftWidth: 3,
    borderColor: colors.terracotta,
    padding: spacing.md,
  },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.control,
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    fontWeight: '700',
    color: colors.tealDeep,
  },
  disabled: { opacity: 0.55 },
  stage: {
    gap: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.tealDeep,
    borderRadius: radii.control,
  },
  light: {
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    color: colors.white,
  },
  video: { width: '100%', aspectRatio: 4 / 3, borderRadius: radii.control },
})
