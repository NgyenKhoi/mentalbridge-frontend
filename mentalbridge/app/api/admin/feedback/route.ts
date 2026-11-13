import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from '@/lib/consultation/authenticated-actor'
import { consultationPool } from '@/lib/db/consultation-pool'

export const dynamic = 'force-dynamic'

interface FeedbackRow {
  id: string
  category: 'CLIENT' | 'SPECIALIST'
  topic: string
  author_id: string | null
  author_name: string
  author_role: string
  author_email: string | null
  target_specialist_id: string | null
  target_specialist_name: string | null
  session_id: string | null
  session_code: string | null
  rating: number
  title: string
  content: string
  tags: string[]
  status: 'RESOLVED' | 'IN_PROGRESS' | 'PENDING'
  created_at: string
  updated_at: string
  admin_response: string | null
  admin_responded_at: string | null
  admin_responder_id: string | null
  internal_notes: string | null
}

interface SpecialistRow {
  account_id: string
  display_name: string
  rating_count: string | null
  rating_sum: string | null
}

interface AggRow {
  total_count: string
  total_sum: string
}

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

  const client = await consultationPool.connect()
  try {
    // 1. Fetch real aggregates from specialist_rating_aggregate
    const aggResult = await client.query<AggRow>(`
      SELECT 
        COALESCE(SUM(rating_count), 0)::text as total_count,
        COALESCE(SUM(rating_sum), 0)::text as total_sum
      FROM specialist_rating_aggregate
    `)

    const totalRatings = Number(aggResult.rows[0]?.total_count || 0)
    const totalSum = Number(aggResult.rows[0]?.total_sum || 0)
    const avgCsat =
      totalRatings > 0 ? (totalSum / totalRatings).toFixed(2) : '5.00'

    // 2. Fetch specialist breakdown
    const specResult = await client.query<SpecialistRow>(`
      SELECT 
        sp.account_id,
        sp.display_name,
        COALESCE(sra.rating_count, 0)::text as rating_count,
        COALESCE(sra.rating_sum, 0)::text as rating_sum
      FROM specialist_profile sp
      LEFT JOIN specialist_rating_aggregate sra ON sra.specialist_account_id = sp.account_id
      WHERE sp.approval_status = 'APPROVED'
      ORDER BY sra.rating_count DESC NULLS LAST
    `)

    const specialists = specResult.rows.map((row: SpecialistRow) => {
      const count = Number(row.rating_count || 0)
      const sum = Number(row.rating_sum || 0)
      return {
        id: row.account_id,
        name: row.display_name,
        ratingCount: count,
        avgRating: count > 0 ? Number((sum / count).toFixed(2)) : 5.0,
      }
    })

    // 3. Fetch all feedback items from platform_feedback
    const feedbackResult = await client.query<FeedbackRow>(`
      SELECT * FROM platform_feedback
      ORDER BY created_at DESC
    `)

    const items = feedbackResult.rows.map((row: FeedbackRow) => ({
      id: row.id,
      category: row.category,
      topic: row.topic,
      authorId: row.author_id,
      authorName: row.author_name,
      authorRole: row.author_role,
      authorEmail: row.author_email,
      targetSpecialistId: row.target_specialist_id,
      targetSpecialist: row.target_specialist_name,
      sessionId: row.session_id,
      sessionCode: row.session_code,
      rating: Number(row.rating),
      title: row.title,
      content: row.content,
      tags: row.tags || [],
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      adminResponse: row.admin_response,
      adminRespondedAt: row.admin_responded_at,
      adminResponderId: row.admin_responder_id,
      internalNotes: row.internal_notes,
    }))

    const clientCount = items.filter(
      (i: (typeof items)[0]) => i.category === 'CLIENT',
    ).length
    const specialistCount = items.filter(
      (i: (typeof items)[0]) => i.category === 'SPECIALIST',
    ).length
    const pendingCount = items.filter(
      (i: (typeof items)[0]) => i.status !== 'RESOLVED',
    ).length
    const resolvedCount = items.filter(
      (i: (typeof items)[0]) => i.status === 'RESOLVED',
    ).length
    const resolutionRate =
      items.length > 0 ? Math.round((resolvedCount / items.length) * 100) : 100

    return carryConsultationSession(
      NextResponse.json({
        kpis: {
          overallCsat: Number(avgCsat),
          totalRatingsCount: totalRatings,
          clientFeedbackCount: clientCount,
          specialistFeedbackCount: specialistCount,
          pendingActionCount: pendingCount,
          resolutionRate,
        },
        specialists,
        feedbacks: items,
        source: 'AUTHORITATIVE_RDS_POSTGRESQL',
        asOf: new Date().toISOString(),
      }),
      actor,
    )
  } catch (error) {
    console.error('[API Admin Feedback Error]', error)
    return carryConsultationSession(
      NextResponse.json(
        { error: 'Lỗi truy xuất cơ sở dữ liệu phản hồi.' },
        { status: 500 },
      ),
      actor,
    )
  } finally {
    client.release()
  }
}

export async function PATCH(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let actor: Awaited<ReturnType<typeof authenticatedConsultationActor>>

  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'ADMIN',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }

  const client = await consultationPool.connect()
  try {
    const body = (await request.json()) as {
      id: string
      status?: 'RESOLVED' | 'IN_PROGRESS' | 'PENDING'
      adminResponse?: string
      internalNotes?: string
    }

    if (!body?.id) {
      return carryConsultationSession(
        NextResponse.json(
          { error: 'Mã phản hồi không hợp lệ.' },
          { status: 400 },
        ),
        actor,
      )
    }

    const updateRes = await client.query<FeedbackRow>(
      `
      UPDATE platform_feedback
      SET
        status = COALESCE($1, status),
        admin_response = COALESCE($2, admin_response),
        internal_notes = COALESCE($3, internal_notes),
        admin_responded_at = CASE WHEN $2 IS NOT NULL THEN NOW() ELSE admin_responded_at END,
        admin_responder_id = '2086fb69-25e7-4d9d-a32e-81977477747c',
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `,
      [
        body.status ?? null,
        body.adminResponse ?? null,
        body.internalNotes ?? null,
        body.id,
      ],
    )

    if (updateRes.rowCount === 0) {
      return carryConsultationSession(
        NextResponse.json(
          { error: 'Không tìm thấy phản hồi trong cơ sở dữ liệu.' },
          { status: 404 },
        ),
        actor,
      )
    }

    const row = updateRes.rows[0]
    return carryConsultationSession(
      NextResponse.json({
        success: true,
        feedback: {
          id: row.id,
          category: row.category,
          topic: row.topic,
          authorName: row.author_name,
          authorRole: row.author_role,
          authorEmail: row.author_email,
          targetSpecialist: row.target_specialist_name,
          rating: Number(row.rating),
          title: row.title,
          content: row.content,
          tags: row.tags,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          adminResponse: row.admin_response,
          adminRespondedAt: row.admin_responded_at,
          internalNotes: row.internal_notes,
        },
      }),
      actor,
    )
  } catch (error) {
    console.error('[API Admin Feedback PATCH Error]', error)
    return carryConsultationSession(
      NextResponse.json(
        { error: 'Lỗi cập nhật phản hồi trong cơ sở dữ liệu.' },
        { status: 500 },
      ),
      actor,
    )
  } finally {
    client.release()
  }
}
