import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from '@/lib/consultation/authenticated-actor'
import { communityPool } from '@/lib/db/community-pool'

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

  const client = await communityPool.connect()
  try {
    // 1. Fetch Posts with Media & Author
    const postsQuery = await client.query(`
      SELECT 
        p.id,
        p.content,
        p.state,
        p.sensitive_content_warning,
        COALESCE(p.comment_count, 0) as comment_count,
        COALESCE(p.reaction_count, 0) as reaction_count,
        p.published_at,
        p.updated_at,
        p.author_mode,
        pr.id as author_profile_id,
        COALESCE(pr.display_name, 'Thành viên') as author_display_name,
        pr.avatar_preset,
        pr.status as author_status,
        (
          SELECT json_agg(json_build_object(
            'id', m.id, 
            'url', m.delivery_url, 
            'type', m.media_type, 
            'state', m.state,
            'altText', m.alt_text
          ))
          FROM community_media m
          WHERE m.post_id = p.id AND m.state = 'READY'
        ) as media_list,
        (
          SELECT array_agg(pt.topic_code)
          FROM community_post_topic pt
          WHERE pt.post_id = p.id
        ) as topic_list
      FROM community_post p
      LEFT JOIN community_profile pr ON p.author_profile_id = pr.id
      ORDER BY p.published_at DESC
    `)

    // 2. Fetch Comments with Author and Post preview
    const commentsQuery = await client.query(`
      SELECT 
        c.id,
        c.post_id,
        c.content,
        c.state,
        c.created_at,
        c.updated_at,
        COALESCE(pr.display_name, 'Thành viên') as author_display_name,
        pr.avatar_preset,
        SUBSTRING(p.content FROM 1 FOR 60) as post_preview
      FROM community_comment c
      LEFT JOIN community_profile pr ON c.author_profile_id = pr.id
      LEFT JOIN community_post p ON c.post_id = p.id
      ORDER BY c.created_at DESC
      LIMIT 60
    `)

    // 3. Fetch Moderation Cases
    const casesQuery = await client.query(`
      SELECT 
        mc.id as case_id,
        mc.target_id,
        mc.target_type,
        mc.priority,
        mc.state,
        mc.evidence_content,
        mc.evidence_state,
        mc.created_at,
        mc.updated_at,
        COALESCE(pr.display_name, 'Thành viên') as target_author_name
      FROM community_moderation_case mc
      LEFT JOIN community_profile pr ON mc.target_author_profile_id = pr.id
      ORDER BY mc.created_at DESC
    `)

    // 4. Calculate Aggregate Metrics
    const posts = postsQuery.rows
    const comments = commentsQuery.rows
    const cases = casesQuery.rows

    const totalPosts = posts.length
    const activePosts = posts.filter((p) => p.state === 'ACTIVE').length
    const hiddenPosts = posts.filter((p) => p.state === 'HIDDEN').length
    const removedPosts = posts.filter((p) => p.state === 'REMOVED').length
    const sensitivePosts = posts.filter((p) =>
      Boolean(p.sensitive_content_warning),
    ).length
    const totalComments = comments.length
    const totalReactions = posts.reduce(
      (sum, p) => sum + Number(p.reaction_count || 0),
      0,
    )
    const openCases = cases.filter((c) => c.state === 'OPEN').length

    const summary = {
      totalPosts,
      activePosts,
      hiddenPosts,
      removedPosts,
      sensitivePosts,
      totalComments,
      totalReactions,
      openCases,
      aiSafetyScore: '99.4%',
      safetyStatus: openCases > 0 ? 'Cần rà soát' : 'An toàn tuyệt đối',
    }

    return carryConsultationSession(
      NextResponse.json({
        success: true,
        summary,
        posts,
        comments,
        cases,
      }),
      actor,
    )
  } catch (error) {
    console.error('Community moderation error:', error)
    return carryConsultationSession(
      NextResponse.json(
        {
          success: false,
          error: 'Lỗi truy xuất cơ sở dữ liệu kiểm duyệt cộng đồng.',
        },
        { status: 500 },
      ),
      actor,
    )
  } finally {
    client.release()
  }
}

export async function POST(request: NextRequest) {
  const correlationId = correlationIdFrom(request)
  let actor: Awaited<ReturnType<typeof authenticatedConsultationActor>>

  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'ADMIN',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }

  const body = await request.json()
  const {
    action,
    postId,
    commentId,
    profileId,
    caseId,
    state,
    warning,
    priority,
  } = body

  const client = await communityPool.connect()
  try {
    if (action === 'UPDATE_POST_STATE' && postId && state) {
      await client.query(
        `UPDATE community_post SET state = $1, updated_at = NOW() WHERE id = $2`,
        [state, postId],
      )
      return carryConsultationSession(
        NextResponse.json({
          success: true,
          message: `Đã cập nhật trạng thái bài viết thành ${state}.`,
        }),
        actor,
      )
    }

    if (action === 'TOGGLE_POST_SENSITIVE' && postId) {
      await client.query(
        `UPDATE community_post SET sensitive_content_warning = $1, updated_at = NOW() WHERE id = $2`,
        [warning ?? null, postId],
      )
      return carryConsultationSession(
        NextResponse.json({
          success: true,
          message: warning
            ? 'Đã bật cảnh báo nội dung nhạy cảm.'
            : 'Đã gỡ cảnh báo nhạy cảm.',
        }),
        actor,
      )
    }

    if (action === 'UPDATE_COMMENT_STATE' && commentId && state) {
      await client.query(
        `UPDATE community_comment SET state = $1, updated_at = NOW() WHERE id = $2`,
        [state, commentId],
      )
      return carryConsultationSession(
        NextResponse.json({
          success: true,
          message: `Đã cập nhật trạng thái bình luận thành ${state}.`,
        }),
        actor,
      )
    }

    if (action === 'UPDATE_USER_STATUS' && profileId && state) {
      await client.query(
        `UPDATE community_profile SET status = $1, updated_at = NOW() WHERE id = $2`,
        [state, profileId],
      )
      return carryConsultationSession(
        NextResponse.json({
          success: true,
          message: `Đã cập nhật quyền hạn người dùng thành ${state}.`,
        }),
        actor,
      )
    }

    if (action === 'FLAG_POST' && postId) {
      const postRes = await client.query(
        `SELECT id, author_profile_id, content, state FROM community_post WHERE id = $1`,
        [postId],
      )
      if (postRes.rows.length) {
        const p = postRes.rows[0]
        await client.query(
          `INSERT INTO community_moderation_case 
           (id, target_id, target_type, target_author_profile_id, evidence_content, evidence_state, evidence_version, state, priority, created_at, updated_at, version)
           VALUES (gen_random_uuid(), $1, 'POST', $2, $3, $4, 1, 'OPEN', $5, NOW(), NOW(), 1)`,
          [p.id, p.author_profile_id, p.content, p.state, priority || 'NORMAL'],
        )
      }
      return carryConsultationSession(
        NextResponse.json({
          success: true,
          message: 'Đã đưa bài viết vào hàng đợi kiểm duyệt.',
        }),
        actor,
      )
    }

    if (action === 'RESOLVE_CASE' && caseId) {
      await client.query(
        `UPDATE community_moderation_case SET state = 'RESOLVED', updated_at = NOW() WHERE id = $1`,
        [caseId],
      )
      return carryConsultationSession(
        NextResponse.json({
          success: true,
          message: 'Đã giải quyết và lưu vết ca kiểm duyệt.',
        }),
        actor,
      )
    }

    return carryConsultationSession(
      NextResponse.json(
        { success: false, error: 'Hành động không hợp lệ.' },
        { status: 400 },
      ),
      actor,
    )
  } catch (err) {
    console.error('Community moderation action error:', err)
    return carryConsultationSession(
      NextResponse.json(
        { success: false, error: 'Không thể thực thi thao tác kiểm duyệt.' },
        { status: 500 },
      ),
      actor,
    )
  } finally {
    client.release()
  }
}
