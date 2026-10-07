import 'server-only'

import type { NextRequest, NextResponse } from 'next/server'

export const INITIAL_CHECK_PHQ9_COOKIE =
  'mentalbridge_initial_check_phq9_assessment'
export const INITIAL_CHECK_GAD7_COOKIE =
  'mentalbridge_initial_check_gad7_assessment'
export const INITIAL_CHECK_EVALUATION_COOKIE =
  'mentalbridge_initial_check_support_evaluation'

type CookieReader = Pick<NextRequest['cookies'], 'get'>

function options() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    priority: 'high' as const,
  }
}

function expire(response: NextResponse, name: string) {
  response.cookies.set(name, '', {
    ...options(),
    expires: new Date(0),
    maxAge: 0,
  })
}

export function readInitialCheckIds(cookies: CookieReader) {
  return {
    phq9AssessmentId: cookies.get(INITIAL_CHECK_PHQ9_COOKIE)?.value,
    gad7AssessmentId: cookies.get(INITIAL_CHECK_GAD7_COOKIE)?.value,
    supportEvaluationId: cookies.get(INITIAL_CHECK_EVALUATION_COOKIE)?.value,
  }
}

export function rememberInitialCheckPhq9(
  response: NextResponse,
  assessmentId: string,
) {
  response.cookies.set(INITIAL_CHECK_PHQ9_COOKIE, assessmentId, options())
  expire(response, INITIAL_CHECK_GAD7_COOKIE)
  expire(response, INITIAL_CHECK_EVALUATION_COOKIE)
}

export function rememberInitialCheckGad7(
  response: NextResponse,
  assessmentId: string,
) {
  response.cookies.set(INITIAL_CHECK_GAD7_COOKIE, assessmentId, options())
  expire(response, INITIAL_CHECK_EVALUATION_COOKIE)
}

export function rememberInitialCheckEvaluation(
  response: NextResponse,
  supportEvaluationId: string,
) {
  response.cookies.set(
    INITIAL_CHECK_EVALUATION_COOKIE,
    supportEvaluationId,
    options(),
  )
}

export function clearInitialCheckAfterPhq9(response: NextResponse) {
  expire(response, INITIAL_CHECK_GAD7_COOKIE)
  expire(response, INITIAL_CHECK_EVALUATION_COOKIE)
}

export function clearInitialCheckEvaluation(response: NextResponse) {
  expire(response, INITIAL_CHECK_EVALUATION_COOKIE)
}

export function clearInitialCheck(response: NextResponse) {
  expire(response, INITIAL_CHECK_PHQ9_COOKIE)
  clearInitialCheckAfterPhq9(response)
}
