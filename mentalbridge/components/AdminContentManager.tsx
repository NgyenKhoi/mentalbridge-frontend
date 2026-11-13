'use client'

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFeedback } from './ui/FeedbackProvider'
import {
  adminResourcesApi,
  type CreateResourceRequest,
  type UpdateResourceRequest,
} from '../lib/api/admin-resources'
import { ApiError, toApiError } from '../lib/api/api-error'

import './admin-content-manager.css'
import CMSResourceEditor from './cms/CMSResourceEditor'
import AdminResourceCatalogue, {
  defaultCatalogueView,
  type CatalogueView,
} from './cms/AdminResourceCatalogue'

type CreateAttempt = {
  fingerprint: string
  key: string
  resourceId?: string
  reviewRecorded?: boolean
}

const initialResourceVersion = 0

function createMayHaveCommitted(error: unknown) {
  const { code, status } = toApiError(error)
  return (
    status === undefined ||
    status >= 500 ||
    code === 'CONTENT_COMMAND_OUTCOME_UNKNOWN'
  )
}

function mutationMessage(error: unknown, fallback: string) {
  const apiError = toApiError(error)
  if (apiError.code === 'INVALID_STATE_TRANSITION') {
    return 'Tài nguyên đã thay đổi. Dữ liệu mới nhất đang được tải lại.'
  }
  if (apiError.code === 'CONTENT_COMMAND_OUTCOME_UNKNOWN') {
    return 'Chưa xác nhận được kết quả thao tác. Hãy tải lại trước khi thử tiếp.'
  }
  if (apiError.status === 403)
    return 'Phiên hiện tại không có quyền quản trị tài nguyên.'
  if (apiError.code === 'CONTENT_TIMEOUT')
    return 'Dịch vụ nội dung phản hồi quá chậm.'
  return fallback
}

export default function AdminContentManager({
  onNotice,
}: {
  onNotice: (message: string) => void
}) {
  const { confirm: confirmAction, showActionToast } = useFeedback()
  const queryClient = useQueryClient()
  const [catalogue, setCatalogue] =
    useState<CatalogueView>(defaultCatalogueView)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reconcilingId, setReconcilingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const createAttempt = useRef<CreateAttempt | null>(null)

  const {
    data: resourcesData,
    isLoading,
    isFetching,
    isError,
    refetch: reloadResources,
  } = useQuery({
    queryKey: ['admin', 'resources'],
    queryFn: () => adminResourcesApi.listAll(),
  })

  const resources = resourcesData?.data ?? []

  const {
    data: detailData,
    error: detailError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ['admin', 'resources', selectedId],
    queryFn: () => adminResourcesApi.getById(selectedId!),
    enabled: selectedId !== null,
  })

  const archiveMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      adminResourcesApi.archive(id, version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      onNotice('Đã lưu trữ tài nguyên thành công')
      showActionToast({ title: 'Đã lưu trữ tài nguyên', tone: 'success' })
    },
    onError: async (mutationError) => {
      onNotice(mutationMessage(mutationError, 'Không thể lưu trữ tài nguyên'))
      await queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
    },
  })

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      version,
      decision,
    }: {
      id: string
      version: number
      decision: 'APPROVED' | 'REJECTED'
    }) =>
      adminResourcesApi.review(
        id,
        version,
        decision,
        decision === 'APPROVED'
          ? 'SOURCE_AND_CONTENT_APPROVED'
          : 'SOURCE_REQUIRES_REVISION',
      ),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      onNotice(
        variables.decision === 'APPROVED'
          ? 'Đã phê duyệt phiên bản tài nguyên'
          : 'Đã từ chối phiên bản tài nguyên',
      )
      showActionToast({
        title: 'Đã ghi nhận quyết định rà soát',
        tone: 'success',
      })
    },
    onError: (mutationError, variables) => {
      onNotice(
        mutationMessage(
          mutationError,
          variables.decision === 'APPROVED'
            ? 'Không thể phê duyệt. Hãy kiểm tra đầy đủ thông tin nguồn và quyền rà soát.'
            : 'Không thể ghi nhận từ chối. Hãy tải lại và kiểm tra quyền rà soát.',
        ),
      )
    },
  })

  const publishMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      adminResourcesApi.publish(id, version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      onNotice('Đã xuất bản phiên bản tài nguyên')
      showActionToast({ title: 'Đã xuất bản tài nguyên', tone: 'success' })
    },
    onError: (mutationError) => {
      onNotice(
        mutationMessage(
          mutationError,
          'Không thể xuất bản. Hãy tải lại và kiểm tra quyết định rà soát.',
        ),
      )
    },
  })

  const createVersionMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      adminResourcesApi.createVersion(id, version),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      onNotice('Đã tạo bản nháp chỉnh sửa mới')
      showActionToast({ title: 'Đã tạo phiên bản mới', tone: 'success' })
    },
    onError: (mutationError) => {
      onNotice(
        mutationMessage(mutationError, 'Không thể tạo bản chỉnh sửa mới'),
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      adminResourcesApi.delete(id, version),
    onSuccess: (_data, target) => {
      setSelectedId((current) => (current === target.id ? null : current))
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      onNotice('Đã xóa tài nguyên thành công')
      showActionToast({ title: 'Đã xóa tài nguyên', tone: 'success' })
    },
    onError: async (mutationError) => {
      onNotice(mutationMessage(mutationError, 'Không thể xóa tài nguyên'))
      await queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
    },
  })

  const createMutation = useMutation({
    mutationFn: async ({
      data,
      attempt,
    }: {
      data: CreateResourceRequest
      attempt: CreateAttempt
    }) => {
      if (!attempt.resourceId) {
        const created = await adminResourcesApi.create(data, attempt.key)
        attempt.resourceId = created.id
        if (created.status === 'ARCHIVED') {
          throw new ApiError({
            code: 'INVALID_STATE_TRANSITION',
            message: 'The resource has been archived.',
            status: 409,
          })
        }
        attempt.reviewRecorded = created.status === 'PUBLISHED'
      }
      if (!attempt.reviewRecorded) {
        await adminResourcesApi.review(
          attempt.resourceId,
          initialResourceVersion,
          'APPROVED',
          'ADMIN_CONFIRMED_SOURCE_AND_CONTENT',
        )
        attempt.reviewRecorded = true
      }
      await adminResourcesApi.publish(attempt.resourceId, initialResourceVersion)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      setCreating(false)
      createAttempt.current = null
      setCatalogue((view) => ({ ...defaultCatalogueView, layout: view.layout }))
      onNotice('Đã xuất bản tài nguyên mới')
      showActionToast({ title: 'Đã xuất bản tài nguyên mới', tone: 'success' })
    },
    onError: (error, { attempt }) => {
      if (createMayHaveCommitted(error)) return
      if (attempt.resourceId) {
        setCreating(false)
        setSelectedId(attempt.resourceId)
        createAttempt.current = null
        void queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      }
      const message =
        toApiError(error).code === 'RESOURCE_REVIEW_AUTHORITY_REQUIRED'
          ? 'Tài nguyên đã được lưu dưới dạng bản nháp. Tài khoản hiện tại cần quyền rà soát để xuất bản.'
          : mutationMessage(
              error,
              attempt.resourceId
                ? 'Chưa thể xuất bản. Hãy kiểm tra trạng thái và thông tin nguồn của tài nguyên.'
                : 'Chưa thể tạo tài nguyên. Hãy kiểm tra lại nội dung và thông tin xuất bản.',
            )
      onNotice(message)
      showActionToast({ title: message, tone: 'error' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      version,
      data,
    }: {
      id: string
      version: number
      data: UpdateResourceRequest
    }) => adminResourcesApi.update(id, version, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      onNotice('Đã cập nhật tài nguyên thành công')
      showActionToast({ title: 'Đã cập nhật tài nguyên', tone: 'success' })
    },
    onError: async (mutationError, variables) => {
      onNotice(mutationMessage(mutationError, 'Không thể cập nhật tài nguyên'))
      const isConflict = toApiError(mutationError).status === 409
      if (isConflict) setReconcilingId(variables.id)

      try {
        await queryClient.invalidateQueries({
          queryKey: ['admin', 'resources'],
        })
      } finally {
        if (isConflict) {
          setReconcilingId((current) =>
            current === variables.id ? null : current,
          )
        }
      }
    },
  })

  const createResource = (data: CreateResourceRequest) => {
    const fingerprint = JSON.stringify(data)
    if (createAttempt.current?.fingerprint !== fingerprint) {
      createAttempt.current = { fingerprint, key: crypto.randomUUID() }
    }
    createMutation.mutate({ data, attempt: createAttempt.current })
  }

  const archiveSelected = async () => {
    if (!selectedId || typeof detailData?.version !== 'number') return
    const confirmed = await confirmAction({
      title: 'Lưu trữ tài nguyên này?',
      description:
        'Tài nguyên sẽ không còn hiển thị với người dùng. Bạn có thể tạo phiên bản chỉnh sửa mới sau khi lưu trữ.',
      confirmLabel: 'Lưu trữ',
      tone: 'warning',
    })
    if (confirmed)
      archiveMutation.mutate({
        id: selectedId,
        version: detailData.version,
      })
  }

  const deleteSelected = async () => {
    if (
      !selectedId ||
      typeof detailData?.version !== 'number' ||
      detailData.isCorrectionDraft
    )
      return
    const confirmed = await confirmAction({
      title: 'Xóa bản nháp tài nguyên?',
      description:
        'Thao tác này không thể hoàn tác. Chỉ tài nguyên đang ở trạng thái bản nháp mới có thể bị xóa.',
      confirmLabel: 'Xóa bản nháp',
      tone: 'danger',
    })
    if (confirmed)
      deleteMutation.mutate({
        id: selectedId,
        version: detailData.version,
      })
  }

  if (creating) {
    const retryAttempt =
      createMutation.isError && createMayHaveCommitted(createMutation.error)
        ? createMutation.variables
        : undefined
    return (
      <CMSResourceEditor
        key="new-resource"
        totalResourcesCount={resources.length}
        onBackToList={() => {
          createAttempt.current = null
          createMutation.reset()
          setCreating(false)
        }}
        onCreate={createResource}
        onRetryCreate={
          retryAttempt ? () => createMutation.mutate(retryAttempt) : undefined
        }
        updatePending={createMutation.isPending}
        onNotice={onNotice}
      />
    )
  }

  if (selectedId) {
    const backToList = () => setSelectedId(null)
    if (detailError || !detailData || reconcilingId === selectedId) {
      return (
        <div className="admin-content-manager">
          <button type="button" className="btn-primary" onClick={backToList}>
            ← Danh sách tài nguyên
          </button>
          {detailError ? (
            <div role="alert">
              <p>Không thể tải chi tiết tài nguyên.</p>
              <button type="button" onClick={() => void refetchDetail()}>
                Thử lại
              </button>
            </div>
          ) : (
            <p role="status">
              {reconcilingId === selectedId
                ? 'Đang tải phiên bản mới nhất…'
                : 'Đang tải tài nguyên…'}
            </p>
          )}
        </div>
      )
    }

    const target = { id: detailData.id, version: detailData.version }
    return (
      <CMSResourceEditor
        key={`${target.id}:${target.version}`}
        detail={detailData}
        totalResourcesCount={resources.length}
        onBackToList={backToList}
        onUpdate={(data) => updateMutation.mutate({ ...target, data })}
        onPublish={() => publishMutation.mutate(target)}
        onReview={(decision) => reviewMutation.mutate({ ...target, decision })}
        onArchive={() => void archiveSelected()}
        onCreateVersion={() => createVersionMutation.mutate(target)}
        onDelete={() => void deleteSelected()}
        updatePending={updateMutation.isPending}
        publishPending={publishMutation.isPending}
        reviewPending={reviewMutation.isPending}
        archivePending={archiveMutation.isPending}
        createVersionPending={createVersionMutation.isPending}
        deletePending={deleteMutation.isPending}
        onNotice={onNotice}
      />
    )
  }

  return (
    <AdminResourceCatalogue
      resources={resources}
      view={catalogue}
      onViewChange={setCatalogue}
      onOpen={setSelectedId}
      onCreate={() => setCreating(true)}
      onRefresh={() => void reloadResources()}
      loading={isLoading}
      refreshing={isFetching}
      error={isError}
    />
  )
}
