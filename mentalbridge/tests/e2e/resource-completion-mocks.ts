import { expect, type Page } from '@playwright/test'
import type {
  ActionOccurrence,
  SupportPlanV3,
} from '../../features/support-plan/api/support-plan-contract'
import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '../../features/support-plan/testing/native-support-plan-fixture'

export const completionResourceId = 'b3000000-0000-4000-8000-000000000670'
export const completionActionId = 'b1000000-0000-4000-8000-000000000670'
export const completionOccurrenceId = 'b2000000-0000-4000-8000-000000000670'

export function resourceCompletionWorld(localDate: string) {
  const current = nativeSupportPlanFixture()
  const action = current.focuses[0].actions[0]
  action.actionId = completionActionId
  action.actionType = 'RESOURCE'
  action.source = {
    ...action.source!,
    ownerDomain: 'CONTENT',
    sourceKind: 'RESOURCE_VERSION',
    sourceId: completionResourceId,
    sourceRevision: '4',
  }
  action.presentation.title = 'Viết vài dòng dịu dàng'
  action.presentation.summary = 'Một khoảng ngắn để nhìn lại ngày của bạn.'
  action.schedules[0].effectiveFrom = localDate
  current.cycle = {
    policyVersion: 'support-plan-cycle-v1',
    lengthDays: 14,
    timezone: 'Asia/Ho_Chi_Minh',
    cycleNumber: 1,
    startedOn: localDate,
    reviewDueOn: localDate,
    currentDay: 1,
    pausedDays: 0,
    state: 'IN_PROGRESS',
  }
  const occurrence: ActionOccurrence = {
    ...emotionOccurrenceFixture(),
    occurrenceId: completionOccurrenceId,
    actionId: completionActionId,
    actionType: 'RESOURCE',
    localDate,
    version: 3,
    displayState: 'SCHEDULED',
    scheduledAt: `${localDate}T01:00:00Z`,
  }
  return { current, occurrences: [occurrence], reconcileStatus: 200 }
}

export type ResourceCompletionWorld = {
  current?: SupportPlanV3
  occurrences: ActionOccurrence[]
  reconcileStatus?: number
}

/** Shared by E2E and no-clock visual captures. No real writes leave the browser. */
export async function mockResourceCompletionDetail(
  page: Page,
  world: ResourceCompletionWorld,
) {
  const localDate = world.occurrences[0].localDate
  const stamp = `${localDate}T05:00:00Z`
  const resource = {
    id: completionResourceId,
    category: 'JOURNALING',
    locale: 'vi-VN',
    title: 'Viết vài dòng dịu dàng',
    summary: 'Một khoảng ngắn để nhìn lại ngày của bạn.',
    contentBody: 'Thực hành ở mức bạn thấy dễ chịu.',
    externalUrl: null,
    sourceOrganization: 'MentalBridge',
    sourceTitle: 'Bài thực hành đã được rà soát',
    sourceUrl: null,
    sourceReviewNote: null,
    resourceKind: 'REFLECTION',
    interactionType: 'REFLECTION',
    repeatability: 'REPEATABLE',
    completionMode: 'STEPS',
    streakEligible: false,
    expectedDurationMinutes: 3,
    cooldownDays: 0,
    recommendedFrequencyPerWeek: 3,
    planTags: [],
    structuredContent: {},
    interactionConfig: {},
    safetyNotes: [],
    sourceRetrievedAt: stamp,
    sourceContentHash: null,
    contentVersionLabel: 'test-v4',
    sourceReviewStatus: 'REVIEWED',
    contentVersion: '4',
    status: 'PUBLISHED',
    reviewedAt: stamp,
    effectiveAt: stamp,
    expiresAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  }
  let progress: object[] = []
  const reads: Array<string | null> = []
  const saves: unknown[] = []
  const reconciles: { ifMatch?: string }[] = []
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
  await page.route(`**/api/resources/${completionResourceId}?**`, (route) => {
    reads.push(
      new URL(route.request().url()).searchParams.get('contentVersion'),
    )
    return route.fulfill(json(resource))
  })
  await page.route('**/api/resources?**', (route) =>
    route.fulfill(json({ items: [resource], hasMore: false })),
  )
  await page.route('**/api/resources/progress?**', (route) =>
    route.fulfill(json({ items: progress })),
  )
  await page.route(
    `**/api/resources/progress/${completionResourceId}/*`,
    (route) => {
      const update = route.request().postDataJSON() as object
      saves.push(update)
      const saved = {
        ...update,
        resourceId: completionResourceId,
        localDate,
        contentVersion: '4',
        version: '1',
        completedAt: stamp,
        updatedAt: stamp,
      }
      progress = [saved]
      return route.fulfill(json(saved))
    },
  )
  await page.route('**/api/care/v2/support-plans/current', (route) =>
    route.fulfill(json(world.current)),
  )
  await page.route('**/api/care/v2/support-plan-occurrences?**', (route) =>
    route.fulfill(
      json({
        supportPlanId: world.current?.supportPlanId,
        supportPlanStatus: world.current?.status,
        representationMode: 'NATIVE_V3',
        from: new URL(route.request().url()).searchParams.get('from'),
        through: new URL(route.request().url()).searchParams.get('through'),
        occurrences: world.occurrences,
        interpretationCode:
          'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
      }),
    ),
  )
  await page.route(
    `**/api/care/v2/support-plan-occurrences/${completionOccurrenceId}/resource/reconcile`,
    (route) => {
      reconciles.push({ ifMatch: route.request().headers()['if-match'] })
      if (world.reconcileStatus && world.reconcileStatus !== 200)
        return route.fulfill(
          json(
            {
              type: 'about:blank',
              title: 'Unavailable',
              status: world.reconcileStatus,
              code:
                world.reconcileStatus === 409
                  ? 'RESOURCE_EVIDENCE_NOT_FOUND'
                  : 'RESOURCE_EVIDENCE_UNAVAILABLE',
            },
            world.reconcileStatus,
          ),
        )
      const next: ActionOccurrence = {
        ...world.occurrences[0],
        state: 'COMPLETED',
        displayState: 'COMPLETED',
        version: world.occurrences[0].version + 1,
        outcomeRecordedAt: stamp,
        completionEvidence: {
          ownerDomain: 'CONTENT',
          kind: 'RESOURCE_COMPLETION',
          factId: `${completionResourceId}:${localDate}`,
          factRevision: '4',
          occurredAt: stamp,
          verifiedAt: stamp,
        },
      }
      world.occurrences[0] = next
      return route.fulfill(json(next))
    },
  )
  return { resource, reads, saves, reconciles }
}

export function resourceCompletionHref(localDate: string) {
  return `/resources/${completionResourceId}?from=support-plan&contentVersion=4&occurrenceId=${completionOccurrenceId}&actionId=${completionActionId}&localDate=${localDate}`
}

export async function completeResourceReflection(page: Page) {
  for (const name of [
    /gọi tên cảm xúc hiện tại/i,
    /viết tự do/i,
    /điều dịu dàng/i,
  ]) {
    const checkbox = page.getByRole('checkbox', { name })
    await expect(checkbox).toBeEnabled()
    // These custom checkboxes receive pointer input through their visible label.
    const label = page.locator('label').filter({ has: checkbox })
    await label.evaluate((element) =>
      element.scrollIntoView({ block: 'center', behavior: 'instant' }),
    )
    await label.click()
    await expect(checkbox).toBeChecked()
  }
  const confirm = page.getByRole('button', { name: 'Xác nhận hoàn thành' })
  await confirm.evaluate((element) =>
    element.scrollIntoView({ block: 'center', behavior: 'instant' }),
  )
  await confirm.click()
  await expect(
    page.getByRole('heading', { name: /xác nhận đã hoàn thành/i }),
  ).toBeHidden()
}
