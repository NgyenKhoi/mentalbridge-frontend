import type { ReassessmentSummary } from '../api/care-contract'

type ReflectionSource = NonNullable<
  ReassessmentSummary['activityReflection']
>['sources'][number]

const helpRank: Record<string, number> = { VERY_HELPFUL: 2, HELPFUL: 1 }

/** Up to three current-period activities the user found helpful, most helpful then most recent. */
export function helpfulSources(summary: ReassessmentSummary) {
  return (summary.activityReflection?.sources ?? [])
    .filter(
      (source): source is ReflectionSource =>
        source.period === 'CURRENT' &&
        (helpRank[source.helpfulness ?? ''] ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        helpRank[b.helpfulness ?? ''] - helpRank[a.helpfulness ?? ''] ||
        Date.parse(b.engagementUpdatedAt) - Date.parse(a.engagementUpdatedAt),
    )
    .slice(0, 3)
}
