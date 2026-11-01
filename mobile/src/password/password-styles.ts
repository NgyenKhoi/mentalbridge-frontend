import { StyleSheet } from 'react-native'

import { colors, radii, spacing, typography } from '@/theme/tokens'

export const passwordStyles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: spacing.lg,
    paddingRight: spacing.lg,
  },
  backLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  field: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputError: {
    borderColor: '#9B352D',
  },
  hint: {
    color: colors.inkFaint,
    fontSize: 14,
    lineHeight: 20,
  },
  fieldError: {
    color: '#9B352D',
    fontSize: 14,
    lineHeight: 20,
  },
  notice: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    color: colors.tealDeep,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  runtimeError: {
    color: '#9B352D',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  actions: {
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  link: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
    minHeight: 48,
    paddingVertical: spacing.md,
  },
})
