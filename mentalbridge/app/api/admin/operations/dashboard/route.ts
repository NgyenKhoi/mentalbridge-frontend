import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from '@/lib/consultation/authenticated-actor'
import { identityClient } from '@/lib/auth/identity-client'
import { consultationClient } from '@/lib/consultation/consultation-client'
import { contentAdminClient } from '@/lib/content/content-client'
import { communityClient } from '@/lib/community/community-client'
import type {
  AdminOperationsDashboardResponse,
  AuthoritativeBlock,
  IdentityAccountsData,
  ConsultationOperationsData,
  NotificationOperationsData,
  CommunityOperationsData,
  UnintegratedMetric,
} from '@/features/dashboard/types/admin-operations'

import { evaluateSourceFreshness } from '@/features/dashboard/lib/source-freshness'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let actor: Awaited<ReturnType<typeof authenticatedConsultationActor>>

  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'ADMIN',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }

  const [
    identityResult,
    consultationResult,
    notificationResult,
    communityResult,
  ] = await Promise.allSettled([
    identityClient.getAccountsSummary(actor.accessToken, correlationId),
    consultationClient.getOperationsSummary(actor.accessToken, correlationId),
    contentAdminClient.getNotificationOperationsSummary(
      actor.accessToken,
      correlationId,
    ),
    communityClient.operationsSummary(actor.accessToken, correlationId),
  ])

  const now = new Date().toISOString()
  const nowEpoch = Date.now()

  let identityBlock: AuthoritativeBlock<IdentityAccountsData>
  if (identityResult.status === 'fulfilled') {
    const freshness = evaluateSourceFreshness(
      identityResult.value.asOf,
      'IDENTITY',
      { now: nowEpoch },
    )
    identityBlock = {
      status: freshness.status,
      source: identityResult.value.source,
      asOf: identityResult.value.asOf,
      data: {
        total: identityResult.value.totalAccounts,
        active: identityResult.value.activeAccounts,
        pendingActivation: identityResult.value.pendingVerificationAccounts,
        disabled: identityResult.value.disabledAccounts,
        deletionPending: identityResult.value.deletionPendingAccounts,
        roles: {
          users: identityResult.value.byRole.users,
          specialists: identityResult.value.byRole.specialists,
          administrators: identityResult.value.byRole.admins,
        },
      },
      error: freshness.status === 'STALE' ? freshness.rationale : null,
    }
  } else {
    identityBlock = {
      status: 'UNAVAILABLE',
      source: 'IDENTITY',
      asOf: now,
      data: null,
      error: 'Identity service summary is currently unreachable.',
    }
  }

  let consultationBlock: AuthoritativeBlock<ConsultationOperationsData>
  if (consultationResult.status === 'fulfilled') {
    const freshness = evaluateSourceFreshness(
      consultationResult.value.asOf,
      'CONSULTATION',
      { now: nowEpoch },
    )
    consultationBlock = {
      status: freshness.status,
      source: consultationResult.value.source,
      asOf: consultationResult.value.asOf,
      data: {
        specialists: consultationResult.value.specialists,
        appointments: consultationResult.value.appointments,
      },
      error: freshness.status === 'STALE' ? freshness.rationale : null,
    }
  } else {
    consultationBlock = {
      status: 'UNAVAILABLE',
      source: 'CONSULTATION',
      asOf: now,
      data: null,
      error: 'Consultation service summary is currently unreachable.',
    }
  }

  let notificationBlock: AuthoritativeBlock<NotificationOperationsData>
  if (notificationResult.status === 'fulfilled') {
    const freshness = evaluateSourceFreshness(
      notificationResult.value.asOf,
      'CONTENT_NOTIFICATION',
      { now: nowEpoch },
    )
    notificationBlock = {
      status: freshness.status,
      source: notificationResult.value.source,
      asOf: notificationResult.value.asOf,
      data: {
        inApp: notificationResult.value.inApp,
        emailReminders: notificationResult.value.emailReminders,
      },
      error: freshness.status === 'STALE' ? freshness.rationale : null,
    }
  } else {
    notificationBlock = {
      status: 'UNAVAILABLE',
      source: 'CONTENT_NOTIFICATION',
      asOf: now,
      data: null,
      error: 'Content notification service summary is currently unreachable.',
    }
  }

  let communityBlock: AuthoritativeBlock<CommunityOperationsData>
  if (communityResult.status === 'fulfilled') {
    const freshness = evaluateSourceFreshness(
      communityResult.value.asOf,
      'COMMUNITY',
      { now: nowEpoch },
    )
    communityBlock = {
      status: freshness.status,
      source: communityResult.value.source,
      asOf: communityResult.value.asOf,
      data: {
        openModerationCases: communityResult.value.openModerationCases,
        totalModerationCases: communityResult.value.totalModerationCases,
      },
      error: freshness.status === 'STALE' ? freshness.rationale : null,
    }
  } else {
    communityBlock = {
      status: 'UNAVAILABLE',
      source: 'COMMUNITY',
      asOf: now,
      data: null,
      error: 'Community service summary is currently unreachable.',
    }
  }

  const unintegrated: UnintegratedMetric[] = [
    {
      id: 'uptime-sla',
      title: 'Tỷ lệ sẵn sàng nền tảng (Uptime SLA)',
      targetDomain: 'Infrastructure / Platform Observability',
      status: 'UNAVAILABLE',
      rationale:
        'Chưa có exporter tổng hợp và SLA projection có thẩm quyền từ hệ thống hạ tầng giám sát. Số liệu mock trước đây đã bị loại bỏ.',
      authoritativeOwnerNeeded:
        'Platform Infrastructure / Prometheus Monitoring',
    },
    {
      id: 'platform-security-score',
      title: 'Chỉ số bảo mật (Platform Security Score)',
      targetDomain: 'Compliance & Security Auditing',
      status: 'UNAVAILABLE',
      rationale:
        'Chưa có hệ thống đánh giá tuân thủ và chứng chỉ bảo mật tự động trong kiến trúc hiện tại. Điểm số giả định trước đây đã bị loại bỏ.',
      authoritativeOwnerNeeded: 'SecOps / Compliance Audit Service',
    },
    {
      id: 'platform-revenue',
      title: 'Doanh thu & Đối soát thanh toán (Billing & Revenue)',
      targetDomain: 'Financial Ledger & Payment Gateway',
      status: 'UNAVAILABLE',
      rationale:
        'Chưa tích hợp domain kế toán đối soát cổng thanh toán chính thức trong scope hệ thống hiện tại.',
      authoritativeOwnerNeeded: 'Payment Gateway / Financial Ledger Projection',
    },
  ]

  const responsePayload: AdminOperationsDashboardResponse = {
    asOf: now,
    identity: identityBlock,
    consultation: consultationBlock,
    notifications: notificationBlock,
    community: communityBlock,
    unintegrated,
  }

  const response = NextResponse.json(responsePayload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Correlation-Id': correlationId,
    },
  })

  return carryConsultationSession(response, actor)
}
