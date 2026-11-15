'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Lock,
  Plus,
  Save,
  Send,
  Trash2,
  Info,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import type {
  CreateResourceRequest,
  ResourceCategory,
  ResourceDetail,
  UpdateResourceRequest,
} from '@/lib/api/admin-resources'
import BlockLibraryModal from './BlockLibraryModal'
import LivePreviewPhone from './LivePreviewPhone'
import {
  BLOCK_LIBRARY_ITEMS,
  type CmsBlockType,
  type CmsEditorState,
  type PresetTemplateDef,
  type MilestoneItem,
  type ChecklistStepItem,
} from './cms-types'
import styles from './cms-editor.module.css'

type EditorResource = Partial<ResourceDetail> &
  Pick<ResourceDetail, 'category' | 'locale' | 'status' | 'title' | 'summary'>

type Props = {
  detail?: EditorResource
  onCreate?: (data: CreateResourceRequest) => void
  onRetryCreate?: () => void
  totalResourcesCount: number
  onBackToList: () => void
  onUpdate?: (data: UpdateResourceRequest) => void
  onPublish?: () => void
  onReview?: (decision: 'APPROVED' | 'REJECTED') => void
  onArchive?: () => void
  onCreateVersion?: () => void
  onDelete?: () => void
  updatePending: boolean
  publishPending?: boolean
  reviewPending?: boolean
  archivePending?: boolean
  createVersionPending?: boolean
  deletePending?: boolean
  onNotice: (msg: string) => void
}

const newDraft: EditorResource = {
  category: 'ARTICLE',
  locale: 'vi-VN',
  status: 'DRAFT',
  title: '',
  summary: '',
}

function defaultBlocks(
  category: ResourceCategory,
  interactionType?: ResourceDetail['interactionType'],
): CmsBlockType[] {
  if (
    interactionType === 'BREATHING_PACER' ||
    (!interactionType && category === 'BREATHING')
  )
    return ['hero', 'breathing']
  if (
    interactionType === 'VIDEO_TRANSCRIPT' ||
    (!interactionType && category === 'VIDEO')
  )
    return ['hero', 'video']
  return ['hero']
}

function dateTimeInput(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function dateTimeValue(value: string, original: string | null | undefined) {
  if (value === dateTimeInput(original)) return original ?? null
  return value ? new Date(value).toISOString() : null
}

export default function CMSResourceEditor({
  detail = newDraft,
  onCreate,
  onRetryCreate,
  totalResourcesCount,
  onBackToList,
  onUpdate,
  onPublish,
  onReview,
  onArchive,
  onCreateVersion,
  onDelete,
  updatePending,
  publishPending,
  reviewPending,
  archivePending,
  createVersionPending,
  deletePending,
  onNotice,
}: Props) {
  const creating = Boolean(onCreate)
  const createRetryOnly = Boolean(onRetryCreate)
  // Extract initial data from backend resource
  const initialBreathingConfig = (detail.interactionConfig ?? {}) as Record<
    string,
    unknown
  >
  const initialStructured = (detail.structuredContent ?? {}) as Record<
    string,
    unknown
  >

  const initialSteps: ChecklistStepItem[] = []
  const savedSteps = [
    initialStructured.cmsChecklist,
    initialStructured.steps,
    initialBreathingConfig.steps,
  ].find(Array.isArray)
  if (Array.isArray(savedSteps)) {
    for (const [index, step] of savedSteps.entries()) {
      if (typeof step === 'string' && step.trim()) {
        initialSteps.push({ id: `step-${index}`, name: step, description: '' })
      } else if (step && typeof step === 'object' && !Array.isArray(step)) {
        const name = step.label ?? step.title
        if (typeof name !== 'string' || !name.trim()) continue
        initialSteps.push({
          id: typeof step.id === 'string' ? step.id : `step-${index}`,
          name,
          description:
            typeof (step.detail ?? step.description) === 'string'
              ? (step.detail ?? step.description)
              : '',
        })
      }
    }
  }

  // Form State
  const [editorState, setEditorState] = useState<CmsEditorState>(() => {
    const inhale = Number(initialBreathingConfig.inhaleSeconds) || 4
    const hold = Number(initialBreathingConfig.holdSeconds ?? 0)
    const exhale = Number(initialBreathingConfig.exhaleSeconds) || 6
    const quote = initialStructured.quote
    const milestones = initialStructured.milestones

    return {
      title: detail.title,
      shortSummary: detail.summary,
      category: detail.category,
      practiceLevel:
        initialStructured.practiceLevel === 'MODERATE' ||
        initialStructured.practiceLevel === 'CHALLENGING' ||
        initialStructured.practiceLevel === 'EASY'
          ? initialStructured.practiceLevel
          : '',
      durationSeconds: (detail.expectedDurationMinutes ?? 0) * 60,
      tags: detail.planTags ?? [],
      coverUrl:
        typeof initialStructured.coverUrl === 'string'
          ? initialStructured.coverUrl
          : '',
      altText:
        typeof initialStructured.altText === 'string'
          ? initialStructured.altText
          : '',

      // Breathing
      inhaleSeconds: inhale,
      holdSeconds: hold,
      exhaleSeconds: exhale,
      breathingStyle:
        initialBreathingConfig.style === 'digital' ? 'digital' : 'lotus',
      previewCycle: true,

      // Video
      videoUrl: detail.externalUrl ?? '',
      videoMilestones: Array.isArray(milestones)
        ? milestones.filter(
            (item): item is MilestoneItem =>
              item &&
              typeof item.id === 'string' &&
              typeof item.time === 'string' &&
              typeof item.label === 'string',
          )
        : [],

      // Checklist
      checklistSteps: initialSteps,

      // Quote
      quoteText:
        quote &&
        typeof quote === 'object' &&
        'text' in quote &&
        typeof quote.text === 'string'
          ? quote.text
          : '',
      quoteAuthor:
        quote &&
        typeof quote === 'object' &&
        'author' in quote &&
        typeof quote.author === 'string'
          ? quote.author
          : '',

      // Safety
      safetyNotesText: detail.safetyNotes?.[0] ?? '',
      audioTitle:
        typeof initialStructured.audioTitle === 'string'
          ? initialStructured.audioTitle
          : '',
      audioFrequency:
        typeof initialStructured.audioFrequency === 'string'
          ? initialStructured.audioFrequency
          : '',
      audioDefaultVolume:
        typeof initialStructured.audioDefaultVolume === 'number'
          ? initialStructured.audioDefaultVolume
          : 40,

      // Mood Slider
      moodScaleMin:
        typeof initialStructured.moodScaleMin === 'string'
          ? initialStructured.moodScaleMin
          : '0',
      moodScaleMax:
        typeof initialStructured.moodScaleMax === 'string'
          ? initialStructured.moodScaleMax
          : '10',

      // Evidence
      sourceOrg: detail.sourceOrganization ?? '',
      sourceDocTitle: detail.sourceTitle ?? '',
      sourceUrl: detail.sourceUrl ?? '',
      sourceRetrievedDate: detail.sourceRetrievedAt
        ? new Date(detail.sourceRetrievedAt).toLocaleDateString('vi-VN')
        : 'Chưa có ngày lấy nguồn',
      sourceReviewPeriod: detail.reviewDecision?.reviewedAt
        ? `Rà soát ngày ${new Date(detail.reviewDecision.reviewedAt).toLocaleDateString('vi-VN')}`
        : 'Chưa rà soát',
      sourceSha256: detail.sourceContentHash ?? '',
      sourceVerified: detail.reviewDecision?.decision === 'APPROVED',

      // Status
      status:
        detail.status === 'PUBLISHED'
          ? 'PUBLISHED'
          : detail.reviewDecision?.decision === 'APPROVED'
            ? 'MEDICAL_APPROVED'
            : 'DRAFT',

      activeBlocks: Array.isArray(initialStructured.activeBlocks)
        ? initialStructured.activeBlocks.filter((id): id is CmsBlockType =>
            BLOCK_LIBRARY_ITEMS.some((block) => block.id === id),
          )
        : [
            ...defaultBlocks(detail.category, detail.interactionType),
            ...(initialSteps.length ? ['checklist' as const] : []),
            ...(quote ? ['quote' as const] : []),
            ...(detail.safetyNotes?.length ? ['safety' as const] : []),
            ...(detail.sourceOrganization ? ['evidence' as const] : []),
          ],
    }
  })
  const initialEditorState = useRef(editorState)

  const [textFields, setTextFields] = useState({
    contentBody: detail.contentBody ?? '',
    locale: detail.locale,
    effectiveAt: dateTimeInput(detail.effectiveAt),
    expiresAt: dateTimeInput(detail.expiresAt),
    sourceReviewNote: detail.sourceReviewNote ?? '',
    sourceRetrievedAt: dateTimeInput(detail.sourceRetrievedAt),
  })
  const [hasEdits, setHasEdits] = useState(false)
  const isDraft = detail.status === 'DRAFT'
  const saving =
    updatePending || reviewPending || publishPending || deletePending
  const reviewDecision = detail.reviewDecision?.decision
  const hasCompleteSource =
    Boolean(detail.sourceOrganization?.trim()) &&
    Boolean(detail.sourceTitle?.trim()) &&
    Boolean(detail.sourceUrl?.trim()) &&
    Boolean(detail.sourceReviewNote?.trim()) &&
    Boolean(detail.sourceRetrievedAt) &&
    /^[a-f0-9]{64}$/.test(detail.sourceContentHash ?? '')

  // Collapsed state for individual blocks
  const [collapsedBlocks, setCollapsedBlocks] = useState<
    Record<string, boolean>
  >({})

  // Modal open
  const [libraryModalOpen, setLibraryModalOpen] = useState(false)
  const [insertTargetIndex, setInsertTargetIndex] = useState<number | null>(
    null,
  )

  // Preview device state
  const [previewDevice, setPreviewDevice] = useState<
    'phone' | 'tablet' | 'desktop'
  >('phone')

  // Clinical calculation:
  // Cycle = inhale + hold + exhale. Total duration (e.g. 300s).
  const cycleSeconds = useMemo(() => {
    return (
      Number(editorState.inhaleSeconds || 0) +
      Number(editorState.holdSeconds || 0) +
      Number(editorState.exhaleSeconds || 0)
    )
  }, [
    editorState.inhaleSeconds,
    editorState.holdSeconds,
    editorState.exhaleSeconds,
  ])

  const cycleSummary = useMemo(() => {
    if (cycleSeconds <= 0)
      return { fullCycles: 0, cycleTime: 0, remainingSec: 0 }
    const totalSec = editorState.durationSeconds
    const fullCycles = Math.max(1, Math.floor(totalSec / cycleSeconds))
    const cycleTime = fullCycles * cycleSeconds
    const remainingSec = Math.max(0, totalSec - cycleTime)
    return { fullCycles, cycleTime, remainingSec }
  }, [cycleSeconds, editorState.durationSeconds])

  // Save handler (persists back to backend via onUpdate)
  const handleSave = () => {
    if (!isDraft || saving || !hasEdits) return
    const title = editorState.title.trim()
    const summary = editorState.shortSummary.trim()
    if (!title || !summary) {
      onNotice('Cần nhập tiêu đề và mô tả ngắn.')
      return
    }
    if (!textFields.contentBody.trim() && !editorState.videoUrl.trim()) {
      onNotice('Cần nhập nội dung hoặc liên kết HTTP(S).')
      return
    }
    if (
      creating &&
      (!editorState.sourceOrg.trim() ||
        !editorState.sourceDocTitle.trim() ||
        !editorState.sourceUrl.trim() ||
        !textFields.sourceReviewNote.trim() ||
        !textFields.sourceRetrievedAt ||
        !/^[a-f0-9]{64}$/i.test(editorState.sourceSha256.trim()))
    ) {
      onNotice('Cần điền đầy đủ thông tin nguồn và mã SHA-256 để xuất bản.')
      return
    }
    if (
      creating &&
      textFields.expiresAt &&
      Date.parse(textFields.expiresAt) <= Date.now()
    ) {
      onNotice('Thời điểm hết hiệu lực phải sau thời điểm xuất bản.')
      return
    }
    if (
      textFields.effectiveAt &&
      textFields.expiresAt &&
      Date.parse(textFields.effectiveAt) >= Date.parse(textFields.expiresAt)
    ) {
      onNotice('Thời điểm hết hiệu lực phải sau thời điểm bắt đầu.')
      return
    }
    if (
      editorState.category === 'VIDEO' &&
      !/^https:\/\/(?:www\.)?youtube\.com\/|^https:\/\/youtu\.be\//i.test(
        editorState.videoUrl.trim(),
      )
    ) {
      onNotice('Video cần liên kết YouTube HTTPS.')
      return
    }
    const initial = initialEditorState.current
    const structuredContent = {
      ...(detail.structuredContent ?? {}),
      ...(editorState.practiceLevel !== initial.practiceLevel && {
        practiceLevel: editorState.practiceLevel,
      }),
      ...(editorState.coverUrl !== initial.coverUrl && {
        coverUrl: editorState.coverUrl,
      }),
      ...(editorState.altText !== initial.altText && {
        altText: editorState.altText,
      }),
      ...(editorState.audioTitle !== initial.audioTitle && {
        audioTitle: editorState.audioTitle,
      }),
      ...(editorState.audioFrequency !== initial.audioFrequency && {
        audioFrequency: editorState.audioFrequency,
      }),
      ...(editorState.moodScaleMin !== initial.moodScaleMin && {
        moodScaleMin: editorState.moodScaleMin,
      }),
      ...(editorState.moodScaleMax !== initial.moodScaleMax && {
        moodScaleMax: editorState.moodScaleMax,
      }),
      ...(editorState.audioDefaultVolume !== initial.audioDefaultVolume && {
        audioDefaultVolume: editorState.audioDefaultVolume,
      }),
      ...(editorState.checklistSteps !== initial.checklistSteps && {
        steps: editorState.checklistSteps.map((step) =>
          step.description ? `${step.name}. ${step.description}` : step.name,
        ),
        cmsChecklist: editorState.checklistSteps.map((step) => ({
          id: step.id,
          label: step.name,
          detail: step.description,
        })),
      }),
      ...((editorState.quoteText !== initial.quoteText ||
        editorState.quoteAuthor !== initial.quoteAuthor) && {
        quote: { text: editorState.quoteText, author: editorState.quoteAuthor },
      }),
      ...(editorState.videoMilestones !== initial.videoMilestones && {
        milestones: editorState.videoMilestones,
      }),
      ...((creating || editorState.activeBlocks !== initial.activeBlocks) && {
        activeBlocks: editorState.activeBlocks,
      }),
    }
    const breathingChanged =
      editorState.inhaleSeconds !== initial.inhaleSeconds ||
      editorState.holdSeconds !== initial.holdSeconds ||
      editorState.exhaleSeconds !== initial.exhaleSeconds ||
      editorState.breathingStyle !== initial.breathingStyle ||
      editorState.durationSeconds !== initial.durationSeconds
    const data: UpdateResourceRequest = {
      title,
      summary,
      locale: textFields.locale,
      contentBody: textFields.contentBody.trim() || null,
      externalUrl: editorState.videoUrl.trim() || null,
      sourceOrganization: editorState.sourceOrg.trim() || null,
      sourceTitle: editorState.sourceDocTitle.trim() || null,
      sourceUrl: editorState.sourceUrl.trim() || null,
      sourceContentHash: editorState.sourceSha256.trim().toLowerCase() || null,
      sourceReviewNote: textFields.sourceReviewNote.trim() || null,
      sourceRetrievedAt: dateTimeValue(
        textFields.sourceRetrievedAt,
        detail.sourceRetrievedAt,
      ),
      effectiveAt: dateTimeValue(textFields.effectiveAt, detail.effectiveAt),
      expiresAt: dateTimeValue(textFields.expiresAt, detail.expiresAt),
      ...(editorState.safetyNotesText !== initial.safetyNotesText && {
        safetyNotes: [
          editorState.safetyNotesText,
          ...(detail.safetyNotes?.slice(1) ?? []),
        ].filter(Boolean),
      }),
      ...(editorState.tags !== initial.tags && { planTags: editorState.tags }),
      ...(editorState.durationSeconds > 0 &&
        editorState.durationSeconds !== initial.durationSeconds && {
          expectedDurationMinutes: Math.round(editorState.durationSeconds / 60),
        }),
      ...(Object.keys(structuredContent).length > 0 && { structuredContent }),
      ...(((detail.interactionType === 'BREATHING_PACER' && breathingChanged) ||
        (creating && editorState.category === 'BREATHING')) && {
        interactionConfig: {
          ...(detail.interactionConfig ?? {}),
          inhaleSeconds: editorState.inhaleSeconds,
          holdSeconds: editorState.holdSeconds,
          exhaleSeconds: editorState.exhaleSeconds,
          cycles: cycleSummary.fullCycles,
          style: editorState.breathingStyle,
        },
      }),
    }
    if (onCreate)
      onCreate({
        ...data,
        category: editorState.category,
        catalogueVisibility: 'LISTED',
        title,
        summary,
      })
    else onUpdate?.(data)
  }

  const handleSaveRef = useRef(handleSave)
  useEffect(() => {
    handleSaveRef.current = handleSave
  })

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    if (creating) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSaveRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [creating])

  // Add block handler
  const handleAddBlock = (blockType: CmsBlockType) => {
    setHasEdits(true)
    setEditorState((prev) => {
      if (insertTargetIndex !== null) {
        const next = [...prev.activeBlocks]
        next.splice(insertTargetIndex + 1, 0, blockType)
        return { ...prev, activeBlocks: next }
      }
      return { ...prev, activeBlocks: [...prev.activeBlocks, blockType] }
    })
    setLibraryModalOpen(false)
    setInsertTargetIndex(null)
    onNotice(
      `Đã chèn khối "${BLOCK_LIBRARY_ITEMS.find((b) => b.id === blockType)?.title}"`,
    )
  }

  // Apply Preset Template
  const handleApplyPreset = (preset: PresetTemplateDef) => {
    setHasEdits(true)
    setEditorState((prev) => ({
      ...prev,
      activeBlocks: [...preset.blocks],
    }))
    setLibraryModalOpen(false)
    onNotice(`Đã áp dụng "${preset.name}" thành công`)
  }

  // Remove block
  const handleRemoveBlock = (index: number) => {
    const targetBlock = editorState.activeBlocks[index]
    if (targetBlock === 'hero' || targetBlock === 'safety') {
      onNotice(
        'Không thể xóa khối Cảnh báo an toàn y tế (Bắt buộc theo chuẩn lâm sàng)',
      )
      return
    }
    setHasEdits(true)
    setEditorState((prev) => ({
      ...prev,
      activeBlocks: prev.activeBlocks.filter((_, i) => i !== index),
    }))
    onNotice('Đã gỡ bỏ khối khỏi bài viết')
  }

  // Duplicate block
  const handleDuplicateBlock = (index: number) => {
    setHasEdits(true)
    const targetBlock = editorState.activeBlocks[index]
    setEditorState((prev) => {
      const next = [...prev.activeBlocks]
      next.splice(index + 1, 0, targetBlock)
      return { ...prev, activeBlocks: next }
    })
    onNotice('Đã nhân đôi khối nội dung')
  }

  // Move block up / down
  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    setHasEdits(true)
    setEditorState((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= prev.activeBlocks.length)
        return prev
      const next = [...prev.activeBlocks]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return { ...prev, activeBlocks: next }
    })
  }

  // Toggle collapse
  const toggleCollapse = (blockKey: string) => {
    setCollapsedBlocks((prev) => ({ ...prev, [blockKey]: !prev[blockKey] }))
  }

  return (
    <div className={styles.editorShell}>
      {/* 1. TOP SUB-HEADER / ACTION TOOLBAR */}
      <header className={styles.topToolbar}>
        <div className={styles.topToolbarLeft}>
          <button
            type="button"
            onClick={onBackToList}
            disabled={saving}
            className={styles.backToListBtn}
            title="Quay lại danh sách tổng"
          >
            <ArrowLeft size={14} />
            <span>Danh sách tài nguyên ({totalResourcesCount} bài viết)</span>
          </button>
        </div>

        <div className={styles.topToolbarRight}>
          {creating && (
            <button
              type="button"
              className={styles.btnPrimaryCms}
              disabled={saving || !hasEdits}
              onClick={onRetryCreate ?? handleSave}
            >
              <Send size={14} />
              {updatePending
                ? 'Đang xuất bản…'
                : createRetryOnly
                  ? 'Thử xuất bản lại'
                  : 'Tạo và xuất bản'}
            </button>
          )}
          {isDraft && !creating && (
            <>
              {!detail.isCorrectionDraft && (
                <button
                  type="button"
                  className={styles.btnDraft}
                  disabled={saving}
                  onClick={onDelete}
                >
                  Xóa bản nháp
                </button>
              )}
              <button
                type="button"
                className={styles.btnDraft}
                disabled={saving || !hasEdits}
                onClick={handleSave}
              >
                <Save size={14} />
                {updatePending ? 'Đang lưu…' : 'Lưu nháp (Ctrl+S)'}
              </button>
              {!reviewDecision && (
                <>
                  <button
                    type="button"
                    className={styles.btnDraft}
                    disabled={saving || hasEdits}
                    onClick={() => onReview?.('REJECTED')}
                  >
                    Từ chối phiên bản
                  </button>
                  <button
                    type="button"
                    className={styles.btnPrimaryCms}
                    disabled={saving || hasEdits || !hasCompleteSource}
                    onClick={() => onReview?.('APPROVED')}
                  >
                    Phê duyệt phiên bản
                  </button>
                </>
              )}
              {reviewDecision === 'APPROVED' && (
                <button
                  type="button"
                  className={styles.btnPrimaryCms}
                  disabled={saving || hasEdits}
                  onClick={onPublish}
                >
                  {publishPending ? 'Đang xuất bản…' : 'Xuất bản phiên bản này'}
                </button>
              )}
            </>
          )}
          {detail.status === 'PUBLISHED' && (
            <button
              type="button"
              className={styles.btnDraft}
              disabled={archivePending}
              onClick={onArchive}
            >
              Lưu trữ
            </button>
          )}
          {detail.status === 'ARCHIVED' && (
            <button
              type="button"
              className={styles.btnPrimaryCms}
              disabled={createVersionPending}
              onClick={onCreateVersion}
            >
              Tạo bản chỉnh sửa mới
            </button>
          )}
        </div>
      </header>

      {/* 2. ARTICLE TITLE & WORKFLOW STEPPER */}
      <section className={styles.workflowBar}>
        <div className={styles.workflowHeaderRow}>
          <div className={styles.titleArea}>
            <h1 className={styles.editorMainTitle}>
              <span className={styles.titleDot}>•</span>
              {creating ? 'Tạo tài nguyên mới' : editorState.title}
            </h1>
            {detail.id && (
              <span className={styles.titleCode}>
                Phiên bản {detail.version}
              </span>
            )}
          </div>
        </div>

        {creating ? (
          <p
            className={styles.workflowNotice}
            role={createRetryOnly ? 'alert' : undefined}
          >
            {createRetryOnly
              ? 'Chưa xác nhận được kết quả. Hãy thử xuất bản lại để tiếp tục với cùng tài nguyên.'
              : 'Khi chọn Tạo và xuất bản, bạn xác nhận đã rà soát nội dung và nguồn. Tài nguyên sẽ hiển thị trong thư viện ngay sau khi xuất bản.'}
          </p>
        ) : (
          <div className={styles.stepperRow}>
            <div
              className={`${styles.stepPill} ${
                editorState.status === 'DRAFT'
                  ? styles.stepPillActive
                  : styles.stepPillCompleted
              }`}
            >
              <span>Bản nháp</span>
            </div>
            <span className={styles.stepArrow}>➔</span>

            <div
              className={`${styles.stepPill} ${
                editorState.status === 'CLINICAL_REVIEW'
                  ? styles.stepPillActive
                  : editorState.status === 'MEDICAL_APPROVED' ||
                      editorState.status === 'PUBLISHED'
                    ? styles.stepPillCompleted
                    : ''
              }`}
            >
              <span>Chờ duyệt lâm sàng</span>
            </div>
            <span className={styles.stepArrow}>➔</span>

            <div
              className={`${styles.stepPill} ${
                editorState.status === 'MEDICAL_APPROVED'
                  ? styles.stepPillActive
                  : editorState.status === 'PUBLISHED'
                    ? styles.stepPillCompleted
                    : ''
              }`}
            >
              <span>Đã duyệt y khoa</span>
            </div>
            <span className={styles.stepArrow}>➔</span>

            <div
              className={`${styles.stepPill} ${
                editorState.status === 'PUBLISHED' ? styles.stepPillActive : ''
              }`}
            >
              <span>Đã xuất bản</span>
            </div>
          </div>
        )}

        {detail.status === 'PUBLISHED' && (
          <p className={styles.workflowNotice}>
            Lưu trữ phiên bản đã xuất bản để tạo bản chỉnh sửa mới.
          </p>
        )}
      </section>

      {/* 4. MAIN 2-COLUMN LAYOUT */}
      <div
        className={`${styles.mainLayoutGrid} ${previewDevice === 'phone' ? '' : styles.widePreviewGrid}`}
      >
        {/* LEFT COLUMN: MODULAR BLOCKS */}
        <main className={styles.blocksColumn}>
          <fieldset
            className={styles.editorFields}
            disabled={!isDraft || saving || createRetryOnly}
            onChange={() => setHasEdits(true)}
          >
            <div className={styles.blocksTopAction}>
              <span className={styles.blocksListCount}>
                Đang có {editorState.activeBlocks.length} khối chức năng trong
                bài
              </span>
              <button
                type="button"
                onClick={() => {
                  setInsertTargetIndex(null)
                  setLibraryModalOpen(true)
                }}
                className={styles.openLibraryBtn}
              >
                <Plus size={15} />
                <span>Thêm khối</span>
              </button>
            </div>

            {editorState.activeBlocks.map((blockType, idx) => {
              const blockDef = BLOCK_LIBRARY_ITEMS.find(
                (b) => b.id === blockType,
              )
              const isMandatory =
                blockType === 'hero' || (blockDef?.isRequired ?? false)
              const isCollapsed =
                collapsedBlocks[`${blockType}-${idx}`] ?? false

              return (
                <div key={`${blockType}-${idx}`}>
                  <div
                    className={`${styles.blockCardFrame} ${
                      isMandatory ? styles.blockCardMandatory : ''
                    }`}
                  >
                    {/* Block Header */}
                    <div
                      className={`${styles.blockHeader} ${
                        isMandatory ? styles.blockHeaderMandatory : ''
                      }`}
                      onClick={() => toggleCollapse(`${blockType}-${idx}`)}
                    >
                      <div className={styles.blockHeaderLeft}>
                        <span className={styles.blockIconCircle}>
                          {blockDef?.number ?? idx + 1}
                        </span>
                        <strong className={styles.blockTitleText}>
                          {blockDef?.title ?? `Khối: ${blockType}`}
                        </strong>
                        <span
                          className={`${styles.blockTag} ${
                            isMandatory ? styles.blockTagRequired : ''
                          }`}
                        >
                          {isMandatory && <Lock size={11} />}
                          {blockDef?.badge}
                        </span>
                      </div>

                      <div
                        className={styles.blockHeaderActions}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Move Up */}
                        <button
                          type="button"
                          onClick={() => handleMoveBlock(idx, 'up')}
                          disabled={idx === 0}
                          className={styles.blockActionIconBtn}
                          title="Di chuyển lên"
                        >
                          <ChevronUp size={15} />
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          onClick={() => handleMoveBlock(idx, 'down')}
                          disabled={idx === editorState.activeBlocks.length - 1}
                          className={styles.blockActionIconBtn}
                          title="Di chuyển xuống"
                        >
                          <ChevronDown size={15} />
                        </button>

                        {/* Duplicate */}
                        <button
                          type="button"
                          onClick={() => handleDuplicateBlock(idx)}
                          className={styles.blockActionIconBtn}
                          title="Nhân đôi khối"
                        >
                          <Copy size={14} />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleRemoveBlock(idx)}
                          disabled={isMandatory}
                          className={styles.blockActionIconBtn}
                          title={
                            isMandatory
                              ? 'Khối bắt buộc an toàn y khoa, không thể xóa'
                              : 'Xóa khối này'
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Block Body */}
                    {!isCollapsed && (
                      <div className={styles.blockBody}>
                        {/* KHỐI 1: HERO & THÔNG TIN TỔNG QUAN */}
                        {blockType === 'hero' && (
                          <>
                            <div className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>
                                Tiêu đề bài viết (Hiển thị người dùng) *
                              </label>
                              <input
                                type="text"
                                value={editorState.title}
                                onChange={(e) =>
                                  setEditorState((prev) => ({
                                    ...prev,
                                    title: e.target.value,
                                  }))
                                }
                                className={styles.inputField}
                                placeholder="Nhập tiêu đề bài tập..."
                              />
                            </div>

                            <div className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>
                                <span>
                                  Mô tả ngắn (Tóm tắt hiển thị người dùng) *
                                </span>
                                <span className={styles.charCounter}>
                                  Khuyến nghị 90 - 140 ký tự (
                                  {editorState.shortSummary.length} ký tự)
                                </span>
                              </label>
                              <textarea
                                rows={2}
                                value={editorState.shortSummary}
                                onChange={(e) =>
                                  setEditorState((prev) => ({
                                    ...prev,
                                    shortSummary: e.target.value,
                                  }))
                                }
                                className={styles.textareaField}
                                placeholder="Tóm tắt nội dung tài nguyên"
                              />
                            </div>

                            <div className={styles.fieldGrid3}>
                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  Danh mục can thiệp
                                </label>
                                <select
                                  value={editorState.category}
                                  disabled={!creating}
                                  onChange={(e) => {
                                    const category = e.target
                                      .value as ResourceCategory
                                    setEditorState((prev) => ({
                                      ...prev,
                                      category,
                                      activeBlocks: [
                                        ...defaultBlocks(category),
                                        ...prev.activeBlocks.filter(
                                          (block) =>
                                            ![
                                              'hero',
                                              'breathing',
                                              'video',
                                            ].includes(block),
                                        ),
                                      ],
                                    }))
                                  }}
                                  className={styles.selectField}
                                >
                                  <option value="BREATHING">
                                    Bài tập điều hòa nhịp thở
                                  </option>
                                  <option value="MEDITATION">Thiền định</option>
                                  <option value="VIDEO">Video thực hành</option>
                                  <option value="ARTICLE">
                                    Bài viết kiến thức
                                  </option>
                                  <option value="JOURNALING">
                                    Nhật ký cảm xúc
                                  </option>
                                  <option value="COMMUNITY">Cộng đồng</option>
                                </select>
                              </div>

                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  Mức độ thực hành
                                </label>
                                <div className={styles.levelChipsGroup}>
                                  <button
                                    type="button"
                                    className={`${styles.levelChip} ${
                                      editorState.practiceLevel === 'EASY'
                                        ? styles.levelChipActive
                                        : ''
                                    }`}
                                    onClick={() => {
                                      setHasEdits(true)
                                      setEditorState((prev) => ({
                                        ...prev,
                                        practiceLevel: 'EASY',
                                      }))
                                    }}
                                  >
                                    Dễ chịu
                                  </button>
                                  <button
                                    type="button"
                                    className={`${styles.levelChip} ${
                                      editorState.practiceLevel === 'MODERATE'
                                        ? styles.levelChipActive
                                        : ''
                                    }`}
                                    onClick={() => {
                                      setHasEdits(true)
                                      setEditorState((prev) => ({
                                        ...prev,
                                        practiceLevel: 'MODERATE',
                                      }))
                                    }}
                                  >
                                    Vừa sức
                                  </button>
                                  <button
                                    type="button"
                                    className={`${styles.levelChip} ${
                                      editorState.practiceLevel ===
                                      'CHALLENGING'
                                        ? styles.levelChipActive
                                        : ''
                                    }`}
                                    onClick={() => {
                                      setHasEdits(true)
                                      setEditorState((prev) => ({
                                        ...prev,
                                        practiceLevel: 'CHALLENGING',
                                      }))
                                    }}
                                  >
                                    Thử thách nhẹ
                                  </button>
                                </div>
                              </div>

                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  Thời lượng dự kiến (phút)
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={120}
                                  value={
                                    editorState.durationSeconds
                                      ? Math.round(
                                          editorState.durationSeconds / 60,
                                        )
                                      : ''
                                  }
                                  onChange={(e) =>
                                    setEditorState((prev) => ({
                                      ...prev,
                                      durationSeconds:
                                        Number(e.target.value) * 60,
                                    }))
                                  }
                                  className={styles.inputField}
                                />
                              </div>
                            </div>

                            <div className={styles.editorCard}>
                              <label className={styles.fieldGroup}>
                                <span className={styles.fieldLabel}>
                                  Nội dung chi tiết
                                </span>
                                <textarea
                                  className={styles.textareaField}
                                  rows={12}
                                  value={textFields.contentBody}
                                  onChange={(e) =>
                                    setTextFields({
                                      ...textFields,
                                      contentBody: e.target.value,
                                    })
                                  }
                                />
                              </label>
                            </div>

                            {/* Tags */}
                            <div className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>
                                Bộ phân loại (Tags)
                              </label>
                              <div className={styles.tagsRow}>
                                {editorState.tags.map((tag, tIdx) => (
                                  <span key={tIdx} className={styles.tagPill}>
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Thumbnail & Alt-text */}
                            <div className={styles.thumbnailBox}>
                              {/^(https?:\/\/|\/(?!\/))/.test(
                                editorState.coverUrl,
                              ) && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={editorState.coverUrl}
                                  alt={editorState.altText}
                                  className={styles.thumbnailPreview}
                                />
                              )}
                              <div className={styles.thumbnailCopy}>
                                <strong
                                  style={{ fontSize: 13, color: '#184737' }}
                                >
                                  Ảnh bìa tài nguyên
                                </strong>
                                <label className={styles.fieldGroup}>
                                  <span className={styles.fieldLabel}>
                                    Đường dẫn ảnh bìa
                                  </span>
                                  <input
                                    className={styles.inputField}
                                    value={editorState.coverUrl}
                                    onChange={(e) =>
                                      setEditorState({
                                        ...editorState,
                                        coverUrl: e.target.value,
                                      })
                                    }
                                  />
                                </label>
                                <span className={styles.thumbnailHint}>
                                  Khuyến nghị tỷ lệ 16:9 hoặc 4:3 (Tối thiểu
                                  1200x675px • Dung lượng &lt; 2MB)
                                </span>
                                <div style={{ marginTop: 6 }}>
                                  <label
                                    className={styles.fieldLabel}
                                    style={{ fontSize: 11.5 }}
                                  >
                                    Văn bản thay thế (Alt-text hỗ trợ người
                                    khiếm thị):
                                  </label>
                                  <input
                                    type="text"
                                    value={editorState.altText}
                                    onChange={(e) =>
                                      setEditorState((prev) => ({
                                        ...prev,
                                        altText: e.target.value,
                                      }))
                                    }
                                    className={styles.inputField}
                                    placeholder="Mô tả bức ảnh cho người khiếm thị..."
                                  />
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {/* KHỐI 2: CÔNG CỤ TƯƠNG TÁC NHỊP THỞ */}
                        {blockType === 'breathing' && (
                          <>
                            <div className={styles.fieldGrid3}>
                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  1. Hít vào (Inhale)
                                </label>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={editorState.inhaleSeconds}
                                    onChange={(e) =>
                                      setEditorState((prev) => ({
                                        ...prev,
                                        inhaleSeconds:
                                          Number(e.target.value) || 4,
                                      }))
                                    }
                                    className={styles.inputField}
                                  />
                                  <span
                                    style={{
                                      fontSize: 13,
                                      color: '#556c60',
                                    }}
                                  >
                                    giây
                                  </span>
                                </div>
                                <span
                                  style={{ fontSize: 11, color: '#637a6e' }}
                                >
                                  Thong thả qua đường mũi
                                </span>
                              </div>

                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  2. Giữ hơi (Hold)
                                </label>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <input
                                    type="number"
                                    min={0}
                                    max={10}
                                    value={editorState.holdSeconds}
                                    onChange={(e) =>
                                      setEditorState((prev) => ({
                                        ...prev,
                                        holdSeconds:
                                          Number(e.target.value) || 0,
                                      }))
                                    }
                                    className={styles.inputField}
                                  />
                                  <span
                                    style={{
                                      fontSize: 13,
                                      color: '#556c60',
                                    }}
                                  >
                                    giây
                                  </span>
                                </div>
                                <span className={styles.warningLimitText}>
                                  Giới hạn an toàn tối đa 4s
                                </span>
                              </div>

                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  3. Thở ra (Exhale)
                                </label>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <input
                                    type="number"
                                    min={1}
                                    max={16}
                                    value={editorState.exhaleSeconds}
                                    onChange={(e) =>
                                      setEditorState((prev) => ({
                                        ...prev,
                                        exhaleSeconds:
                                          Number(e.target.value) || 5,
                                      }))
                                    }
                                    className={styles.inputField}
                                  />
                                  <span
                                    style={{
                                      fontSize: 13,
                                      color: '#556c60',
                                    }}
                                  >
                                    giây
                                  </span>
                                </div>
                                <span
                                  style={{ fontSize: 11, color: '#637a6e' }}
                                >
                                  Khí thoát đều đặn qua miệng
                                </span>
                              </div>
                            </div>

                            {/* Hộp tự động tính toán chu kỳ chuẩn y tế */}
                            <div className={styles.clinicalFormulaBox}>
                              <Info size={18} className={styles.formulaIcon} />
                              <div>
                                <div className={styles.formulaTitle}>
                                  Hệ thống tự cân bằng chu kỳ chuẩn y tế:
                                </div>
                                <div className={styles.formulaText}>
                                  Tổng chu kỳ:{' '}
                                  <strong>
                                    {cycleSeconds} giây/vòng (
                                    {editorState.inhaleSeconds}s Hít +{' '}
                                    {editorState.holdSeconds}s Giữ +{' '}
                                    {editorState.exhaleSeconds}s Thở)
                                  </strong>
                                  . Cân bằng {editorState.durationSeconds} giây
                                  tương đương{' '}
                                  <strong>
                                    {cycleSummary.fullCycles} vòng trọn vẹn (
                                    {cycleSummary.cycleTime}s)
                                  </strong>{' '}
                                  +{' '}
                                  <strong>
                                    {cycleSummary.remainingSec} giây ổn định
                                    nhịp tim kết thúc
                                  </strong>
                                  .
                                </div>
                              </div>
                            </div>

                            <div className={styles.fieldGrid2}>
                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  Kiểu đồ họa mô phỏng
                                </label>
                                <select
                                  value={editorState.breathingStyle}
                                  onChange={(e) =>
                                    setEditorState((prev) => ({
                                      ...prev,
                                      breathingStyle: e.target.value as
                                        'lotus' | 'digital',
                                    }))
                                  }
                                  className={styles.selectField}
                                >
                                  <option value="lotus">
                                    🌸 Vòng tròn hoa sen (Lotus Circle)
                                  </option>
                                  <option value="digital">
                                    ⏱️ Đồng hồ số nhịp
                                  </option>
                                </select>
                              </div>

                              <div
                                className={styles.fieldGroup}
                                style={{ justifyContent: 'center' }}
                              >
                                <label
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: '#274f40',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={editorState.previewCycle}
                                    onChange={(e) =>
                                      setEditorState((prev) => ({
                                        ...prev,
                                        previewCycle: e.target.checked,
                                      }))
                                    }
                                  />
                                  <span>
                                    Xem thử 1 chu kỳ thở trên bảng điều khiển
                                  </span>
                                </label>
                              </div>
                            </div>
                          </>
                        )}

                        {/* KHỐI 3: VIDEO HƯỚNG DẪN ĐỒNG HÀNH & MỐC THỜI GIAN */}
                        {blockType === 'video' && (
                          <>
                            <div className={styles.fieldGrid2}>
                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  Liên kết video YouTube
                                </label>
                                <input
                                  type="text"
                                  value={editorState.videoUrl}
                                  onChange={(e) =>
                                    setEditorState((prev) => ({
                                      ...prev,
                                      videoUrl: e.target.value,
                                    }))
                                  }
                                  className={styles.inputField}
                                />
                              </div>
                            </div>

                            {/* Milestones list */}
                            <div className={styles.milestonesManager}>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <label className={styles.fieldLabel}>
                                  Mốc thời gian từng bước trong video
                                  (Milestones Timeline)
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditorState((prev) => ({
                                      ...prev,
                                      videoMilestones: [
                                        ...prev.videoMilestones,
                                        {
                                          id: `m-${Date.now()}`,
                                          time: '05:00',
                                          label: 'Bước mới',
                                        },
                                      ],
                                    }))
                                  }
                                  style={{
                                    fontSize: 12,
                                    color: '#059669',
                                    fontWeight: 700,
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  + Thêm mốc
                                </button>
                              </div>

                              {editorState.videoMilestones.map((ms, msIdx) => (
                                <div
                                  key={ms.id}
                                  className={styles.milestoneRowInput}
                                >
                                  <input
                                    type="text"
                                    value={ms.time}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setEditorState((prev) => ({
                                        ...prev,
                                        videoMilestones:
                                          prev.videoMilestones.map((item, i) =>
                                            i === msIdx
                                              ? { ...item, time: val }
                                              : item,
                                          ),
                                      }))
                                    }}
                                    className={`${styles.inputField} ${styles.milestoneTimeInput}`}
                                  />
                                  <input
                                    type="text"
                                    value={ms.label}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setEditorState((prev) => ({
                                        ...prev,
                                        videoMilestones:
                                          prev.videoMilestones.map((item, i) =>
                                            i === msIdx
                                              ? { ...item, label: val }
                                              : item,
                                          ),
                                      }))
                                    }}
                                    className={styles.inputField}
                                    style={{ flex: 1 }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditorState((prev) => ({
                                        ...prev,
                                        videoMilestones:
                                          prev.videoMilestones.filter(
                                            (_, i) => i !== msIdx,
                                          ),
                                      }))
                                    }
                                    style={{
                                      border: 'none',
                                      background: 'none',
                                      color: '#94a3b8',
                                      cursor: 'pointer',
                                      padding: 4,
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {/* KHỐI 4: DANH SÁCH BƯỚC THỰC HÀNH (CHECKLIST) */}
                        {blockType === 'checklist' && (
                          <>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <label className={styles.fieldLabel}>
                                Tách bạch 2 ô nhập: Tên bước &amp; Mô tả chi
                                tiết cách thực hiện
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditorState((prev) => ({
                                    ...prev,
                                    checklistSteps: [
                                      ...prev.checklistSteps,
                                      {
                                        id: `step-${Date.now()}`,
                                        name: 'Tên bước mới',
                                        description:
                                          'Mô tả chi tiết động tác hoặc thao tác cần chuẩn bị...',
                                      },
                                    ],
                                  }))
                                }
                                style={{
                                  fontSize: 12,
                                  color: '#185243',
                                  fontWeight: 750,
                                  background: '#edf5f0',
                                  border: '1px solid #c7dcd0',
                                  padding: '5px 12px',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                }}
                              >
                                + Thêm bước mới
                              </button>
                            </div>

                            {editorState.checklistSteps.map((step, sIdx) => (
                              <div
                                key={step.id}
                                className={styles.checklistStepCard}
                              >
                                <div className={styles.stepIndexBadge}>
                                  {sIdx + 1}
                                </div>
                                <div className={styles.stepInputsCol}>
                                  <input
                                    type="text"
                                    value={step.name}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setEditorState((prev) => ({
                                        ...prev,
                                        checklistSteps: prev.checklistSteps.map(
                                          (item, i) =>
                                            i === sIdx
                                              ? { ...item, name: val }
                                              : item,
                                        ),
                                      }))
                                    }}
                                    className={styles.inputField}
                                    placeholder="Tên bước ngắn gọn..."
                                  />
                                  <textarea
                                    rows={2}
                                    value={step.description}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setEditorState((prev) => ({
                                        ...prev,
                                        checklistSteps: prev.checklistSteps.map(
                                          (item, i) =>
                                            i === sIdx
                                              ? {
                                                  ...item,
                                                  description: val,
                                                }
                                              : item,
                                        ),
                                      }))
                                    }}
                                    className={styles.textareaField}
                                    placeholder="Mô tả chi tiết cách thực hiện..."
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditorState((prev) => ({
                                      ...prev,
                                      checklistSteps:
                                        prev.checklistSteps.filter(
                                          (_, i) => i !== sIdx,
                                        ),
                                    }))
                                  }
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: 4,
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </>
                        )}

                        {/* KHỐI 5: LỜI KHUYÊN CHÁNH NIỆM & TRÍCH DẪN */}
                        {blockType === 'quote' && (
                          <>
                            <div className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>
                                Thông điệp tích cực nuôi dưỡng tinh thần cho
                                thân chủ
                              </label>
                              <textarea
                                rows={2}
                                value={editorState.quoteText}
                                onChange={(e) =>
                                  setEditorState((prev) => ({
                                    ...prev,
                                    quoteText: e.target.value,
                                  }))
                                }
                                className={styles.textareaField}
                                placeholder="Nhập câu trích dẫn vỗ về..."
                              />
                            </div>
                            <div className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>
                                Tác giả / Nguồn trích dẫn
                              </label>
                              <input
                                type="text"
                                value={editorState.quoteAuthor}
                                onChange={(e) =>
                                  setEditorState((prev) => ({
                                    ...prev,
                                    quoteAuthor: e.target.value,
                                  }))
                                }
                                className={styles.inputField}
                                placeholder="Ví dụ: Thiền sư Thích Nhất Hạnh"
                              />
                            </div>
                          </>
                        )}

                        {/* KHỐI 6 / 8: CẢNH BÁO AN TOÀN Y KHOA & HOTLINE (BẮT BUỘC) */}
                        {blockType === 'safety' && (
                          <div className={styles.safetyNoticeBox}>
                            <div className={styles.safetyRuleNote}>
                              🔒 BẮT BUỘC • KHÓA CHỈNH SỬA TẠI BÀI: Quy định y
                              khoa bắt buộc mọi bài tập tự chăm sóc phải có
                              hướng dẫn dừng khi choáng/khó thở và số điện thoại
                              hỗ trợ sinh mạng.
                            </div>

                            <div className={styles.fieldGroup}>
                              <label className={styles.fieldLabel}>
                                Cảnh báo triệu chứng &amp; Hướng dẫn ứng phó
                                khẩn cấp
                              </label>
                              <textarea
                                rows={2}
                                value={editorState.safetyNotesText}
                                onChange={(e) =>
                                  setEditorState((prev) => ({
                                    ...prev,
                                    safetyNotesText: e.target.value,
                                  }))
                                }
                                className={styles.textareaField}
                              />
                            </div>
                          </div>
                        )}

                        {/* KHỐI 7: ÂM THANH TRỊ LIỆU KÈM THEO */}
                        {blockType === 'audio' && (
                          <>
                            <div className={styles.fieldGrid2}>
                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  Tên bản nhạc trị liệu
                                </label>
                                <input
                                  type="text"
                                  value={editorState.audioTitle}
                                  onChange={(e) =>
                                    setEditorState((prev) => ({
                                      ...prev,
                                      audioTitle: e.target.value,
                                    }))
                                  }
                                  className={styles.inputField}
                                />
                              </div>
                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  Tần số sóng não / Hiệu ứng
                                </label>
                                <input
                                  type="text"
                                  value={editorState.audioFrequency}
                                  onChange={(e) =>
                                    setEditorState((prev) => ({
                                      ...prev,
                                      audioFrequency: e.target.value,
                                    }))
                                  }
                                  className={styles.inputField}
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {/* KHỐI 8: THƯỚC ĐO CẢM XÚC TRƯỚC/SAU */}
                        {blockType === 'mood_slider' && (
                          <>
                            <div className={styles.fieldGrid2}>
                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  Nhãn cực tiểu (0)
                                </label>
                                <input
                                  type="text"
                                  value={editorState.moodScaleMin}
                                  onChange={(e) =>
                                    setEditorState((prev) => ({
                                      ...prev,
                                      moodScaleMin: e.target.value,
                                    }))
                                  }
                                  className={styles.inputField}
                                />
                              </div>
                              <div className={styles.fieldGroup}>
                                <label className={styles.fieldLabel}>
                                  Nhãn cực đại (10)
                                </label>
                                <input
                                  type="text"
                                  value={editorState.moodScaleMax}
                                  onChange={(e) =>
                                    setEditorState((prev) => ({
                                      ...prev,
                                      moodScaleMax: e.target.value,
                                    }))
                                  }
                                  className={styles.inputField}
                                />
                              </div>
                            </div>
                          </>
                        )}

                        {/* KHỐI 9: NGUỒN BẰNG CHỨNG Y KHOA */}
                        {blockType === 'evidence' && (
                          <>
                            <table className={styles.evidenceTable}>
                              <tbody>
                                <tr>
                                  <td className={styles.evidenceLabel}>
                                    Tổ chức nguồn y khoa:
                                  </td>
                                  <td>
                                    <input
                                      type="text"
                                      value={editorState.sourceOrg}
                                      onChange={(e) =>
                                        setEditorState((prev) => ({
                                          ...prev,
                                          sourceOrg: e.target.value,
                                        }))
                                      }
                                      className={styles.inputField}
                                    />
                                  </td>
                                </tr>
                                <tr>
                                  <td className={styles.evidenceLabel}>
                                    Tên tài liệu trích nguyên:
                                  </td>
                                  <td>
                                    <input
                                      type="text"
                                      value={editorState.sourceDocTitle}
                                      onChange={(e) =>
                                        setEditorState((prev) => ({
                                          ...prev,
                                          sourceDocTitle: e.target.value,
                                        }))
                                      }
                                      className={styles.inputField}
                                    />
                                  </td>
                                </tr>
                                <tr>
                                  <td className={styles.evidenceLabel}>
                                    Liên kết HTTP(S) gốc trích dẫn:
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <input
                                        type="url"
                                        value={editorState.sourceUrl}
                                        onChange={(e) =>
                                          setEditorState((prev) => ({
                                            ...prev,
                                            sourceUrl: e.target.value,
                                          }))
                                        }
                                        className={styles.inputField}
                                      />
                                      <a
                                        href={
                                          /^https?:\/\//i.test(
                                            editorState.sourceUrl,
                                          )
                                            ? editorState.sourceUrl
                                            : undefined
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                          display: 'grid',
                                          placeItems: 'center',
                                          padding: '0 10px',
                                          borderRadius: 8,
                                          background: '#edf5f0',
                                          color: '#185243',
                                        }}
                                      >
                                        <ExternalLink size={14} />
                                      </a>
                                    </div>
                                  </td>
                                </tr>
                                <tr>
                                  <td className={styles.evidenceLabel}>
                                    Ngày lấy nguồn &amp; Rà soát:
                                  </td>
                                  <td>
                                    <span
                                      style={{
                                        fontSize: 13,
                                        color: '#334155',
                                      }}
                                    >
                                      {editorState.sourceRetrievedDate} •{' '}
                                      {editorState.sourceReviewPeriod}
                                    </span>
                                  </td>
                                </tr>
                                <tr>
                                  <td className={styles.evidenceLabel}>
                                    Mã băm kiểm toán SHA-256:
                                  </td>
                                  <td>
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        flexWrap: 'wrap',
                                      }}
                                    >
                                      <code
                                        style={{
                                          fontSize: 11.5,
                                          color: '#065f46',
                                          wordBreak: 'break-all',
                                        }}
                                      >
                                        {editorState.sourceSha256}
                                      </code>
                                      {editorState.sourceVerified && (
                                        <span className={styles.shaBadge}>
                                          <CheckCircle2 size={12} />
                                          Nguồn đã được rà soát
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* IN-BETWEEN ADD BLOCK BUTTON */}
                  <div className={styles.betweenAddBlockBar}>
                    <button
                      type="button"
                      onClick={() => {
                        setInsertTargetIndex(idx)
                        setLibraryModalOpen(true)
                      }}
                      className={styles.betweenAddBlockBtn}
                    >
                      <Plus size={13} />
                      <span>Thêm khối tại đây</span>
                    </button>
                  </div>
                </div>
              )
            })}
            <details className={styles.editorCard} open={creating || undefined}>
              <summary>
                {creating ? 'Thông tin nguồn và xuất bản' : 'Thông tin xuất bản'}
              </summary>
              {(
                [
                  ['locale', 'Ngôn ngữ (BCP 47)', 'text'],
                  ['effectiveAt', 'Hiệu lực từ', 'datetime-local'],
                  ['expiresAt', 'Hết hiệu lực', 'datetime-local'],
                  ['sourceRetrievedAt', 'Ngày lấy nguồn', 'datetime-local'],
                  ['sourceReviewNote', 'Ghi chú rà soát', 'text'],
                ] as const
              )
                .filter(([name]) => !creating || name !== 'effectiveAt')
                .map(([name, label, type]) => (
                  <label key={name} className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>
                      {label}
                      {creating && name.startsWith('source') ? ' *' : ''}
                    </span>
                    <input
                      className={styles.inputField}
                      type={type}
                      value={textFields[name]}
                      onChange={(e) =>
                        setTextFields({ ...textFields, [name]: e.target.value })
                      }
                    />
                  </label>
                ))}
              <label className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Liên kết HTTP(S)</span>
                <input
                  className={styles.inputField}
                  type="url"
                  value={editorState.videoUrl}
                  onChange={(e) =>
                    setEditorState({
                      ...editorState,
                      videoUrl: e.target.value,
                    })
                  }
                />
              </label>
              {(
                [
                  ['sourceOrg', 'Tổ chức nguồn', 'text'],
                  ['sourceDocTitle', 'Tên tài liệu nguồn', 'text'],
                  ['sourceUrl', 'Liên kết nguồn', 'url'],
                  ['sourceSha256', 'Mã kiểm tra SHA-256', 'text'],
                ] as const
              ).map(([name, label, type]) => (
                <label key={name} className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>
                    {label}
                    {creating ? ' *' : ''}
                  </span>
                  <input
                    className={styles.inputField}
                    type={type}
                    value={editorState[name]}
                    onChange={(e) =>
                      setEditorState({
                        ...editorState,
                        [name]: e.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </details>
          </fieldset>
        </main>

        {/* RIGHT COLUMN: STICKY LIVE PREVIEW PHONE */}
        <aside>
          <LivePreviewPhone
            data={editorState}
            contentBody={
              textFields.contentBody ||
              (typeof initialStructured.overview === 'string'
                ? initialStructured.overview
                : '')
            }
            safetyNotes={detail.safetyNotes?.slice(1) ?? []}
            previewDevice={previewDevice}
            onDeviceChange={setPreviewDevice}
          />
        </aside>
      </div>

      {/* 5. MODAL: THƯ VIỆN KHỐI NỘI DUNG V2.4 MODULAR */}
      <BlockLibraryModal
        isOpen={libraryModalOpen}
        onClose={() => setLibraryModalOpen(false)}
        activeBlocks={editorState.activeBlocks}
        onAddBlock={handleAddBlock}
        onApplyPreset={handleApplyPreset}
      />
    </div>
  )
}
