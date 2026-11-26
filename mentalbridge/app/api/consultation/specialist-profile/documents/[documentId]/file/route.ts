import { NextResponse, type NextRequest } from 'next/server'

import { correlationIdFrom } from '@/lib/auth/bff-response'
import {
  authenticatedConsultationActor,
  carryConsultationSession,
  consultationAuthenticationFailure,
} from '@/lib/consultation/authenticated-actor'
import {
  consultationFailure,
  localProblem,
} from '@/lib/consultation/bff-response'
import { consultationClient } from '@/lib/consultation/consultation-client'

const maxCredentialBytes = 10 * 1024 * 1024

function credentialMediaType(content: ArrayBuffer) {
  const bytes = Buffer.from(content)
  if (bytes.subarray(0, 5).equals(Buffer.from('%PDF-')))
    return 'application/pdf'
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    return 'image/jpeg'
  if (
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png'
  return null
}

export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/consultation/specialist-profile/documents/[documentId]/file'>,
) {
  const correlationId = correlationIdFrom(request)
  let actor: Awaited<ReturnType<typeof authenticatedConsultationActor>>
  try {
    actor = await authenticatedConsultationActor(request, correlationId, [
      'SPECIALIST',
    ])
  } catch (error) {
    return consultationAuthenticationFailure(error, correlationId)
  }
  const { documentId } = await context.params
  let signedUrl
  try {
    const result = await consultationClient.credentialFile(
      actor.accessToken,
      correlationId,
      documentId,
      false,
    )
    signedUrl = result.data.url
  } catch (error) {
    return carryConsultationSession(
      consultationFailure(error, correlationId),
      actor,
    )
  }

  function unavailable() {
    return carryConsultationSession(
      localProblem(
        502,
        'CREDENTIAL_FILE_UNAVAILABLE',
        'Không thể mở tệp. Hãy thử lại.',
        correlationId,
      ),
      actor,
    )
  }

  try {
    const storageUrl = new URL(signedUrl)
    if (
      storageUrl.origin !== 'https://api.cloudinary.com' ||
      !/^\/v1_1\/[^/]+\/(?:raw|image)\/download$/.test(storageUrl.pathname) ||
      storageUrl.username ||
      storageUrl.password
    )
      return unavailable()

    const file = await fetch(storageUrl, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]),
    })
    if (file.status === 420 || file.status === 429) {
      await file.body?.cancel()
      return carryConsultationSession(
        localProblem(
          429,
          'CREDENTIAL_FILE_BUSY',
          'Tệp đang được tải quá nhiều lần. Hãy đợi một lúc rồi thử lại.',
          correlationId,
        ),
        actor,
      )
    }
    if (
      !file.ok ||
      Number(file.headers.get('content-length')) > maxCredentialBytes
    ) {
      await file.body?.cancel()
      return unavailable()
    }
    const content = await file.arrayBuffer()
    const mediaType = credentialMediaType(content)
    if (!mediaType || content.byteLength > maxCredentialBytes)
      return unavailable()

    return carryConsultationSession(
      new NextResponse(content, {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': mediaType,
          'X-Content-Type-Options': 'nosniff',
          'X-Correlation-Id': correlationId,
        },
      }),
      actor,
    )
  } catch {
    return unavailable()
  }
}
