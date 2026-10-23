import type { HomeNextStep } from '@/features/assessment/api/care-contract'
import {
  getResourceCatalogue,
  getResourceDetail,
  type PublicResourceSummary,
} from '@/features/resources/api/browser-resources'
import { planResourceHref } from '@/features/resources/model/plan-resources'
import { getSupportGuide } from '@/features/support-guide/api/browser-support-guide'
import { guideReturnQuery } from '@/features/support-guide/components/guided-continuation'
import { getCurrentPlanResourceActions } from '@/features/support-plan/api/browser-support-plan-actions'
import { homeResourceTypeLabel } from './home-presentation'

export type HomeResourceSource = 'plan' | 'guide' | 'library'
export type HomeResource = Readonly<{
  id: string
  title: string
  href: string
  category: PublicResourceSummary['category']
  meta: string | null
  action: string
}>
export type HomeResourcesData = Readonly<{
  source: HomeResourceSource
  items: readonly HomeResource[]
}>

/** Home displays Content metadata only; category defaults must not invent duration. */
export function homeResourceMeta(
  resource: Partial<
    Pick<PublicResourceSummary, 'category' | 'expectedDurationMinutes'>
  >,
) {
  const type = resource.category && homeResourceTypeLabel(resource.category)
  const minutes = resource.expectedDurationMinutes
  if (!type || !minutes || minutes <= 0) return null
  return `${type} · ${minutes} phút`
}

function homeResource(
  resource: PublicResourceSummary,
  href: string,
): HomeResource {
  return {
    id: resource.id,
    title: resource.title,
    href,
    category: resource.category,
    meta: homeResourceMeta(resource),
    action:
      resource.category === 'ARTICLE'
        ? 'Đọc'
        : resource.category === 'VIDEO'
          ? 'Xem'
          : 'Làm ngay',
  }
}

/** Select one source in authority order; a failed source remains a local retry. */
export async function loadHomeResources(
  home: HomeNextStep | null,
  signal?: AbortSignal,
): Promise<HomeResourcesData> {
  if (home?.plan) {
    const plan = await getCurrentPlanResourceActions(
      home.plan.localDate,
      signal,
    )
    if (plan.planState !== 'NONE' && plan.actions.length > 0) {
      const nextOccurrence = home.plan.nextOccurrence
      const nextResourceId = plan.actions.find(
        (action) =>
          action.actionId === nextOccurrence?.actionId ||
          (action.today != null &&
            action.today.occurrenceId === nextOccurrence?.occurrenceId),
      )?.resource.resourceId
      const items = await Promise.all(
        plan.actions
          .filter((action) => action.resource.resourceId !== nextResourceId)
          .slice(0, 3)
          .map(async (action) => {
            const detail = await getResourceDetail(
              action.resource.resourceId,
              action.resource.resourceVersion,
              signal,
            )
            return homeResource(
              detail,
              planResourceHref(action, plan.localDate),
            )
          }),
      )
      return { source: 'plan', items }
    }
  }

  if (home?.journey.supportGuideId) {
    const guide = await getSupportGuide(home.journey.supportGuideId)
    if (guide.resources.length > 0) {
      const items = await Promise.all(
        guide.resources.slice(0, 3).map(async (resource) => {
          const detail = await getResourceDetail(
            resource.resourceId,
            resource.contentVersion,
            signal,
          )
          const query = new URLSearchParams(guideReturnQuery(guide))
          query.set('contentVersion', resource.contentVersion)
          return homeResource(
            detail,
            `/resources/${encodeURIComponent(resource.resourceId)}?${query}`,
          )
        }),
      )
      return { source: 'guide', items }
    }
  }

  const catalogue = await getResourceCatalogue(signal, 'vi-VN')
  if (catalogue.unavailable) throw new Error('Resource catalogue unavailable')
  return {
    source: 'library',
    items: catalogue.items
      .slice(0, 3)
      .map((resource) =>
        homeResource(resource, `/resources/${encodeURIComponent(resource.id)}`),
      ),
  }
}
