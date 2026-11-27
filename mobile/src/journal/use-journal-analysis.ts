import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { useEffect, useState } from 'react'

import { ApiError } from '@/api/api-error'

import {
  analysisRequestStore,
  type AnalysisRequestMarker,
  type AnalysisRequestStore,
} from './analysis-request-store'
import type { JournalApi } from './journal-api'
import {
  samePeriods,
  type AnalysisJob,
  type AnalysisTarget,
  type TrendJob,
} from './journal-contract'

export function analysisTargetKey(target: AnalysisTarget) {
  return target.kind === 'EXACT'
    ? `${target.journalId}.${target.revision}`
    : `trend.${Date.parse(target.request.previousPeriod.startAt)}.${Date.parse(target.request.previousPeriod.endAt)}.${Date.parse(target.request.currentPeriod.startAt)}.${Date.parse(target.request.currentPeriod.endAt)}`
}

export function validateAnalysisTarget(
  job: AnalysisJob | TrendJob,
  target: AnalysisTarget,
  jobId?: string,
) {
  const matches =
    target.kind === 'EXACT'
      ? 'journalId' in job &&
        job.journalId === target.journalId &&
        job.journalRevision === target.revision
      : 'previousPeriod' in job && samePeriods(job, target.request)
  if (!matches || (jobId && job.jobId !== jobId))
    throw new ApiError({
      message: 'Analysis source mismatch.',
      code: 'ANALYSIS_SOURCE_MISMATCH',
      status: 502,
    })
  return job
}

export function useJournalAnalysis(
  api: JournalApi,
  subject: string,
  target: AnalysisTarget,
  store: AnalysisRequestStore = analysisRequestStore,
) {
  const client = useQueryClient()
  const targetKey = analysisTargetKey(target)
  const [marker, setMarker] = useState<AnalysisRequestMarker | null>(null)
  const [restored, setRestored] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const authorizationKey = ['journal', subject, 'ai-authorization'] as const
  const authorization = useQuery({
    queryKey: authorizationKey,
    queryFn: () => api.authorization(),
    refetchOnMount: 'always',
    retry: false,
  })
  const disclosure = useQuery({
    queryKey: ['journal', subject, 'ai-disclosure'],
    queryFn: () => api.disclosure(),
    refetchOnMount: 'always',
    retry: false,
  })
  useEffect(() => {
    let active = true
    store
      .read(subject, targetKey)
      .then((value) => {
        if (active) {
          setMarker(value)
          setRestored(true)
        }
      })
      .catch(() => {
        if (active) {
          setStorageError(true)
          setRestored(true)
        }
      })
    return () => {
      active = false
    }
  }, [store, subject, targetKey])
  const job = useQuery({
    queryKey: ['journal', subject, 'analysis', targetKey, marker?.jobId],
    enabled: restored && Boolean(marker?.jobId),
    retry: false,
    refetchOnMount: 'always',
    queryFn: async () =>
      validateAnalysisTarget(
        target.kind === 'EXACT'
          ? await api.analysisJob(marker!.jobId!)
          : await api.trendJob(marker!.jobId!),
        target,
        marker!.jobId,
      ),
    refetchInterval: (query) =>
      !query.state.error && query.state.data?.status === 'RUNNING'
        ? 1500
        : false,
  })
  const request = useMutation({
    mutationFn: async () => {
      if (!restored || storageError)
        throw new Error('Request marker is unavailable')
      // Never trust the cached permission for a new request/retry. Journal/AI also
      // rechecks consent and entitlement server-side; no internal endpoint is used.
      const fresh = await api.authorization()
      client.setQueryData(authorizationKey, fresh)
      if (!fresh.authorized || fresh.policyVersion !== disclosure.data?.version)
        throw new ApiError({
          message: 'AI consent required.',
          code: 'CONSENT_REQUIRED',
          status: 403,
        })
      if (marker?.jobId && job.data?.status !== 'FAILED')
        throw new Error('Only a terminal failed request can be retried')
      const pending: AnalysisRequestMarker =
        marker && !marker.jobId ? marker : { requestKey: randomUUID() }
      await store.write(subject, targetKey, pending)
      setMarker(pending)
      const accepted = validateAnalysisTarget(
        target.kind === 'EXACT'
          ? await api.requestAnalysis(
              target.journalId,
              target.revision,
              pending.requestKey,
            )
          : await api.requestTrend(target.request, pending.requestKey),
        target,
      )
      const confirmed = { ...pending, jobId: accepted.jobId }
      // Keep the same request key if storing the accepted identifier fails. An
      // explicit retry reconciles the original request, never auto-submits on mount.
      await store.write(subject, targetKey, confirmed)
      setMarker(confirmed)
      client.setQueryData(
        ['journal', subject, 'analysis', targetKey, accepted.jobId],
        accepted,
      )
      return accepted
    },
  })
  const consent = useMutation({
    mutationFn: (granted: boolean) => {
      if (!disclosure.data) throw new Error('Disclosure is unavailable')
      return api.consent(disclosure.data.version, granted, randomUUID())
    },
    onSuccess: async () => {
      await authorization.refetch()
      if (marker?.jobId) await job.refetch()
    },
  })
  return {
    marker,
    restored,
    storageError,
    authorization,
    disclosure,
    job,
    request,
    consent,
  }
}
