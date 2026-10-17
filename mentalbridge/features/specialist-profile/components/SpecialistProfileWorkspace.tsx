'use client'

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  BadgeCheck,
  BookOpenText,
  BriefcaseBusiness,
  Check,
  CircleUserRound,
  Clock3,
  Eye,
  FileBadge2,
  FilePlus2,
  FileText,
  Globe2,
  Languages,
  LockKeyhole,
  Minus,
  Plus,
  Save,
  ShieldCheck,
  UserRound,
  Video,
} from 'lucide-react'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import type {
  SpecialistDecisionReason,
  SpecialistProfile,
  SpecialistProfileInput,
  SupportArea,
} from '@/lib/consultation/consultation-validation'
import {
  browserConsultation,
  BrowserConsultationError,
} from '../api/browser-client'
import type { CredentialDocument } from '../api/credential-validation'
import type { ProfileAmendment } from '../api/amendment-validation'
import SpecialistCredentialViewer from './SpecialistCredentialViewer'
import SpecialistCredentialUploadDialog from './SpecialistCredentialUploadDialog'
import styles from './SpecialistProfileWorkspace.module.css'

const empty: SpecialistProfileInput = {
  displayName: '',
  bio: '',
  supportAreas: [],
  languages: ['vi'],
  yearsOfExperience: 0,
  timezone: 'Asia/Ho_Chi_Minh',
}

const reasonLabels: Record<SpecialistDecisionReason, string> = {
  PROFILE_INFORMATION_INCOMPLETE: 'Thông tin hồ sơ chưa đầy đủ.',
  PROFILE_CONTENT_NOT_APPROVED: 'Nội dung hồ sơ chưa phù hợp để công khai.',
  OUTSIDE_SUPPORTED_SCOPE: 'Phạm vi hỗ trợ nằm ngoài phạm vi của nền tảng.',
  POLICY_VIOLATION: 'Tài khoản đang bị tạm ngưng do vi phạm chính sách.',
  QUALITY_REVIEW_REQUIRED: 'Tài khoản đang được rà soát chất lượng.',
  ACCOUNT_REVIEW_REQUIRED: 'Tài khoản đang được rà soát vận hành.',
}

const supportAreaLabels: Record<SupportArea, string> = {
  DEPRESSIVE_SYMPTOMS: 'Cảm xúc trầm buồn',
  ANXIETY_SYMPTOMS: 'Lo âu',
}

const languageLabels: Record<string, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  zh: '中文',
  fr: 'Français',
}

type ViewStatus =
  | 'NEW'
  | 'PENDING_DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'

function viewStatus(profile: SpecialistProfile | null): ViewStatus {
  if (!profile) return 'NEW'
  if (profile.approvalStatus !== 'PENDING') return profile.approvalStatus
  return profile.submittedAt ? 'PENDING_REVIEW' : 'PENDING_DRAFT'
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts
    .slice(-2)
    .map((part) => Array.from(part)[0]?.toLocaleUpperCase('vi') ?? '')
    .join('')
}

export default function SpecialistProfileWorkspace() {
  const { showActionToast } = useFeedback()
  const [form, setForm] = useState<SpecialistProfileInput>(empty)
  const [savedForm, setSavedForm] = useState<SpecialistProfileInput>(empty)
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [amendment, setAmendment] = useState<ProfileAmendment | null>(null)
  const [amendmentEtag, setAmendmentEtag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  )
  const [documents, setDocuments] = useState<CredentialDocument[]>([])
  const [documentsError, setDocumentsError] = useState('')
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [badgeBusyId, setBadgeBusyId] = useState<string | null>(null)
  const [readAttempt, setReadAttempt] = useState(0)

  useEffect(() => {
    let active = true
    browserConsultation
      .own()
      .then(async (result) => {
        if (!active) return
        setProfile(result.data)
        setDocumentsLoading(true)
        setEtag(result.etag)
        setForm(result.data)
        setSavedForm(result.data)
        let editable: SpecialistProfileInput = result.data
        if (result.data.approvalStatus === 'APPROVED') {
          const current = await browserConsultation.ownAmendment()
          if (!active) return
          const pending = current.data.amendment
          if (pending && !['APPROVED', 'CANCELLED'].includes(pending.status)) {
            setAmendment(pending)
            setAmendmentEtag(current.etag)
            editable = pending.proposedProfile
          }
        }
        setForm(editable)
        setSavedForm(editable)
      })
      .catch((cause: unknown) => {
        if (
          active &&
          (!(cause instanceof BrowserConsultationError) || cause.status !== 404)
        )
          setError(
            cause instanceof BrowserConsultationError
              ? cause.message
              : 'Chưa thể tải hồ sơ. Hãy kiểm tra kết nối và thử lại.',
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [readAttempt])

  const profileAccountId = profile?.accountId

  useEffect(() => {
    if (!profileAccountId) return
    let active = true
    browserConsultation
      .credentialDocuments()
      .then((result) => {
        if (active) {
          setDocuments(result.data)
          setDocumentsError('')
        }
      })
      .catch(() => {
        if (active)
          setDocumentsError(
            'Không thể tải giấy tờ. Hãy tải lại trang để thử lại.',
          )
      })
      .finally(() => {
        if (active) setDocumentsLoading(false)
      })
    return () => {
      active = false
    }
  }, [profileAccountId])

  const status = viewStatus(profile)
  const locked = status === 'SUSPENDED'
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm)
  const statusTitle: Record<ViewStatus, string> = {
    NEW: 'Chưa tạo hồ sơ',
    PENDING_DRAFT: 'Bản nháp chờ gửi',
    PENDING_REVIEW: 'Đang chờ xét duyệt',
    APPROVED: 'Đã phê duyệt',
    REJECTED: 'Cần chỉnh sửa và gửi lại',
    SUSPENDED: 'Đang tạm ngưng',
  }
  const completionChecks = useMemo(
    () => [
      { label: 'Tên hiển thị', done: form.displayName.trim().length > 0 },
      { label: 'Phần giới thiệu', done: form.bio.trim().length > 0 },
      { label: 'Lĩnh vực hỗ trợ', done: form.supportAreas.length > 0 },
      { label: 'Ngôn ngữ', done: form.languages.length > 0 },
      { label: 'Số năm kinh nghiệm', done: form.yearsOfExperience > 0 },
    ],
    [form],
  )
  const completion = Math.round(
    (completionChecks.filter((item) => item.done).length /
      completionChecks.length) *
      100,
  )
  const canSave =
    !busy &&
    !locked &&
    dirty &&
    form.displayName.trim().length > 0 &&
    form.bio.trim().length > 0 &&
    form.supportAreas.length > 0 &&
    form.languages.length > 0

  function toggleArea(area: SupportArea) {
    setForm((current) => ({
      ...current,
      supportAreas: current.supportAreas.includes(area)
        ? current.supportAreas.filter((item) => item !== area)
        : [...current.supportAreas, area],
    }))
  }

  function toggleLanguage(language: string) {
    setForm((current) => ({
      ...current,
      languages: current.languages.includes(language)
        ? current.languages.filter((item) => item !== language)
        : [...current.languages, language],
    }))
  }

  async function setBadge(document: CredentialDocument, visible: boolean) {
    setBadgeBusyId(document.id)
    setDocumentsError('')
    try {
      const result = await browserConsultation.credentialBadge(
        document.id,
        visible,
        document.version,
      )
      setDocuments((current) =>
        current.map((item) => (item.id === document.id ? result.data : item)),
      )
      showActionToast({
        title: visible ? 'Đã hiện huy hiệu trên hồ sơ' : 'Đã ẩn huy hiệu',
        tone: 'success',
      })
    } catch (cause) {
      setDocumentsError(
        cause instanceof Error
          ? cause.message
          : 'Không thể đổi huy hiệu. Hãy thử lại.',
      )
    } finally {
      setBadgeBusyId(null)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const previous = status
      if (status === 'APPROVED') {
        let current = amendment
        let currentEtag = amendmentEtag
        if (!current) {
          if (!etag)
            throw new Error('Không có phiên bản hồ sơ để bắt đầu chỉnh sửa.')
          const started = await browserConsultation.startAmendment(etag)
          current = started.data
          currentEtag = started.etag
          setAmendment(current)
          setAmendmentEtag(currentEtag)
        }
        if (!currentEtag) throw new Error('Không có phiên bản bản chỉnh sửa.')
        const result = await browserConsultation.saveAmendment(
          current.id,
          form,
          currentEtag,
        )
        setAmendment(result.data)
        setAmendmentEtag(result.etag)
        setForm(result.data.proposedProfile)
        setSavedForm(result.data.proposedProfile)
        const message =
          'Đã lưu bản chỉnh sửa riêng tư. Gửi xét duyệt để cập nhật hồ sơ công khai.'
        setNotice(message)
        showActionToast({ title: message, tone: 'success' })
        return
      }
      const result = await browserConsultation.save(form, etag)
      setForm(result.data)
      setSavedForm(result.data)
      setProfile(result.data)
      setEtag(result.etag)
      window.dispatchEvent(new Event('mb:specialist-profile-updated'))
      const successMessage =
        previous === 'PENDING_REVIEW'
          ? 'Đã lưu thay đổi. Hồ sơ đã rời hàng đợi; hãy gửi lại khi sẵn sàng.'
          : previous === 'REJECTED'
            ? 'Đã lưu thay đổi. Hãy gửi lại hồ sơ để được xét duyệt.'
            : 'Đã lưu hồ sơ.'
      setNotice(successMessage)
      showActionToast({ title: successMessage, tone: 'success' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu hồ sơ.')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (status === 'APPROVED' ? !amendment || !amendmentEtag : !etag) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (status === 'APPROVED' && amendment && amendmentEtag) {
        const result = await browserConsultation.submitAmendment(
          amendment.id,
          amendment.status === 'REJECTED' ? 'resubmit' : 'submit',
          amendmentEtag,
        )
        setAmendment(result.data)
        setAmendmentEtag(result.etag)
        setNotice('Bản chỉnh sửa đã được gửi để quản trị viên xét duyệt.')
        showActionToast({
          title: 'Đã gửi bản chỉnh sửa để xét duyệt',
          tone: 'success',
        })
        return
      }
      const profileEtag = etag
      if (!profileEtag)
        throw new Error('Không có phiên bản hồ sơ để gửi xét duyệt.')
      const result =
        status === 'REJECTED'
          ? await browserConsultation.resubmit(profileEtag)
          : await browserConsultation.submit(profileEtag)
      setForm(result.data)
      setSavedForm(result.data)
      setProfile(result.data)
      setEtag(result.etag)
      window.dispatchEvent(new Event('mb:specialist-profile-updated'))
      setNotice('Hồ sơ đã được gửi để quản trị viên xét duyệt.')
      showActionToast({ title: 'Đã gửi hồ sơ để xét duyệt', tone: 'success' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể gửi hồ sơ.')
    } finally {
      setBusy(false)
    }
  }

  async function cancelAmendment() {
    if (!amendment || !amendmentEtag) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await browserConsultation.cancelAmendment(amendment.id, amendmentEtag)
      setAmendment(null)
      setAmendmentEtag(null)
      if (profile) {
        setForm(profile)
        setSavedForm(profile)
      }
      const message =
        'Đã hủy bản chỉnh sửa. Đã khôi phục thông tin hồ sơ đã phê duyệt.'
      setNotice(message)
      showActionToast({ title: message, tone: 'success' })
      window.dispatchEvent(new Event('mb:specialist-profile-updated'))
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể hủy bản chỉnh sửa.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (loading)
    return (
      <section className={styles.loading} aria-busy="true">
        Đang tải hồ sơ…
      </section>
    )

  if (error && !profile)
    return (
      <section className={styles.loading}>
        <p role="alert">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError('')
            setLoading(true)
            setReadAttempt((value) => value + 1)
          }}
        >
          Thử lại
        </button>
      </section>
    )

  return (
    <section className={styles.workspace}>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>
            <CircleUserRound aria-hidden="true" /> Không gian chuyên gia
          </span>
          <h1>Hồ sơ chuyên gia</h1>
          <p>
            Hoàn thiện thông tin để người dùng hiểu lĩnh vực hỗ trợ và kinh
            nghiệm của bạn.
          </p>
        </div>
        <div className={styles.headingActions}>
          <button
            className={styles.documentsButton}
            data-profile-ui
            type="button"
            onClick={() => {
              setSelectedDocumentId(null)
              setDocumentsOpen(true)
            }}
          >
            <Eye aria-hidden="true" /> Xem giấy tờ
          </button>
          {!locked && dirty && (
            <button
              className={styles.topSave}
              data-profile-ui
              type="submit"
              form="specialist-profile-form"
              disabled={!canSave}
            >
              <Save aria-hidden="true" />
              {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          )}
        </div>
      </header>

      <div className={styles.columns}>
        <form
          id="specialist-profile-form"
          className={styles.form}
          onSubmit={save}
        >
          <section className={`${styles.card} ${styles.profileHero}`}>
            <div className={styles.banner} aria-hidden="true" />
            <div className={styles.profileSummary}>
              <div className={styles.avatar} aria-hidden="true">
                {initials(form.displayName)}
              </div>
              <div className={styles.profileIdentity}>
                <h2>{form.displayName || 'Tên hiển thị của bạn'}</h2>
                <p>
                  Chuyên gia tâm lý{' '}
                  <span data-state={status}>{statusTitle[status]}</span>
                  {amendment &&
                    !['APPROVED', 'CANCELLED'].includes(amendment.status) && (
                      <span className={styles.amendmentPill}>
                        Bản chỉnh sửa (
                        {amendment.status === 'DRAFT'
                          ? 'Chưa gửi duyệt'
                          : 'Chờ xét duyệt'}
                        )
                      </span>
                    )}
                </p>
                {amendment &&
                  !['APPROVED', 'CANCELLED'].includes(amendment.status) &&
                  profile?.displayName &&
                  profile.displayName !== form.displayName && (
                    <p className={styles.publicNameHint}>
                      Tên hiển thị công khai hiện tại:{' '}
                      <strong>{profile.displayName}</strong>
                    </p>
                  )}
              </div>
            </div>
            <p className={styles.heroHint}>
              Ảnh đại diện hiện dùng tên viết tắt của bạn.
            </p>
            <div className={styles.heroStats} aria-label="Tổng quan hồ sơ">
              <div>
                <strong>{form.yearsOfExperience}</strong>
                <span>Năm kinh nghiệm</span>
              </div>
              <div>
                <strong>{form.supportAreas.length}</strong>
                <span>Lĩnh vực hỗ trợ</span>
              </div>
              <div>
                <strong>{form.languages.length}</strong>
                <span>Ngôn ngữ</span>
              </div>
              <div>
                <strong>{completion}%</strong>
                <span>Đã hoàn thiện</span>
              </div>
            </div>
          </section>

          <div className={styles.status} data-state={status}>
            <strong>{statusTitle[status]}</strong>
            <span>
              {status === 'PENDING_REVIEW'
                ? 'Nếu sửa, hồ sơ sẽ rời hàng đợi cho đến khi bạn gửi lại.'
                : status === 'REJECTED'
                  ? 'Bạn có thể sửa cùng hồ sơ này rồi gửi lại để xét duyệt.'
                  : status === 'SUSPENDED'
                    ? 'Hồ sơ và lịch tương lai đã bị khóa. Quản trị viên cần khôi phục tài khoản.'
                    : status === 'APPROVED'
                      ? amendment?.status === 'PENDING_REVIEW'
                        ? 'Bản chỉnh sửa đang chờ quản trị viên duyệt. Hồ sơ công khai hiện tại vẫn hoạt động.'
                        : amendment?.status === 'REJECTED'
                          ? 'Bản chỉnh sửa cần điều chỉnh rồi gửi lại để xét duyệt.'
                          : 'Hồ sơ công khai đang hoạt động. Các thay đổi mới cần được xét duyệt trước khi hiển thị.'
                      : 'Lưu bản nháp, kiểm tra lại rồi gửi duyệt.'}
            </span>
          </div>

          {profile?.decisionReasonCode && (
            <p className={styles.reason} role="status">
              <strong>Lý do:</strong> {reasonLabels[profile.decisionReasonCode]}
            </p>
          )}

          <section className={`${styles.card} ${styles.section}`}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionIcon}>
                <UserRound aria-hidden="true" />
              </span>
              <div>
                <h3>Thông tin cơ bản</h3>
                <p>Tên và lời giới thiệu người dùng đọc đầu tiên.</p>
              </div>
            </div>
            <label className={styles.field}>
              <span>Tên hiển thị</span>
              <input
                required
                maxLength={120}
                disabled={locked}
                value={form.displayName}
                placeholder="Ví dụ: ThS. BS. Minh Anh"
                onChange={(event) =>
                  setForm({ ...form, displayName: event.target.value })
                }
              />
            </label>
            <label className={styles.field}>
              <span>Giới thiệu</span>
              <textarea
                required
                maxLength={2000}
                rows={5}
                disabled={locked}
                value={form.bio}
                placeholder="Bạn hỗ trợ ai, theo cách nào, và bạn có kinh nghiệm gì?"
                onChange={(event) =>
                  setForm({ ...form, bio: event.target.value })
                }
              />
              <small>{form.bio.length}/2000</small>
            </label>
          </section>

          <section className={`${styles.card} ${styles.section}`}>
            <div className={styles.sectionHead}>
              <span className={`${styles.sectionIcon} ${styles.amberIcon}`}>
                <BookOpenText aria-hidden="true" />
              </span>
              <div>
                <h3>Chuyên môn</h3>
                <p>Chọn lĩnh vực bạn có thể hỗ trợ.</p>
              </div>
            </div>
            <fieldset className={styles.optionGrid} disabled={locked}>
              {(
                [
                  ['DEPRESSIVE_SYMPTOMS', 'Sàng lọc PHQ-9'],
                  ['ANXIETY_SYMPTOMS', 'Sàng lọc GAD-7'],
                ] as const
              ).map(([area, hint]) => (
                <label className={styles.option} key={area}>
                  <input
                    type="checkbox"
                    checked={form.supportAreas.includes(area)}
                    onChange={() => toggleArea(area)}
                  />
                  <span>
                    <i aria-hidden="true" />
                    <span>
                      <strong>{supportAreaLabels[area]}</strong>
                      <small>{hint}</small>
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </section>

          <section className={`${styles.card} ${styles.section}`}>
            <div className={styles.sectionHead}>
              <span className={styles.sectionIcon}>
                <Globe2 aria-hidden="true" />
              </span>
              <div>
                <h3>Ngôn ngữ, kinh nghiệm và hình thức tư vấn</h3>
                <p>
                  Giúp người dùng chọn đúng người phù hợp với cách họ muốn trò
                  chuyện.
                </p>
              </div>
            </div>
            <strong className={styles.groupLabel}>Ngôn ngữ tư vấn</strong>
            <fieldset className={styles.optionGrid} disabled={locked}>
              {['vi', 'en', 'zh', 'fr'].map((language) => (
                <label className={styles.option} key={language}>
                  <input
                    type="checkbox"
                    checked={form.languages.includes(language)}
                    onChange={() => toggleLanguage(language)}
                  />
                  <span>
                    <i aria-hidden="true" />
                    <strong>{languageLabels[language]}</strong>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className={styles.field}>
              <span>Số năm kinh nghiệm</span>
              <div className={styles.stepper}>
                <button
                  type="button"
                  aria-label="Giảm số năm kinh nghiệm"
                  disabled={locked || form.yearsOfExperience <= 0}
                  onClick={() =>
                    setForm({
                      ...form,
                      yearsOfExperience: Math.max(
                        0,
                        form.yearsOfExperience - 1,
                      ),
                    })
                  }
                >
                  <Minus aria-hidden="true" />
                </button>
                <input
                  type="number"
                  min={0}
                  max={80}
                  required
                  disabled={locked}
                  value={form.yearsOfExperience}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      yearsOfExperience: Number(event.target.value),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="Tăng số năm kinh nghiệm"
                  disabled={locked || form.yearsOfExperience >= 80}
                  onClick={() =>
                    setForm({
                      ...form,
                      yearsOfExperience: Math.min(
                        80,
                        form.yearsOfExperience + 1,
                      ),
                    })
                  }
                >
                  <Plus aria-hidden="true" />
                </button>
              </div>
            </label>
            <div className={styles.serviceDetails}>
              <div>
                <span>Thời lượng mỗi phiên</span>
                <strong>
                  <Clock3 aria-hidden="true" /> 60 phút
                </strong>
              </div>
              <div>
                <span>Hình thức tư vấn</span>
                <strong>
                  <Video aria-hidden="true" /> Trực tuyến · Chat hoặc Video
                  trong ứng dụng
                </strong>
              </div>
            </div>
          </section>

          <section className={`${styles.card} ${styles.section}`}>
            <div className={styles.credentialHeading}>
              <div className={styles.sectionHead}>
                <span className={`${styles.sectionIcon} ${styles.amberIcon}`}>
                  <FileBadge2 aria-hidden="true" />
                </span>
                <div>
                  <h3>Bằng cấp và giấy phép hành nghề</h3>
                  <p>
                    Tải lên để đội ngũ xác minh. Bấm “Xem” để mở bản đã tải lên.
                  </p>
                </div>
              </div>
              <button
                className={styles.addCredential}
                data-profile-ui
                type="button"
                disabled={!profile}
                onClick={() => setUploadOpen(true)}
              >
                <FilePlus2 aria-hidden="true" /> Thêm giấy tờ
              </button>
            </div>
            {documentsLoading && (
              <p className={styles.credentialState}>Đang tải giấy tờ…</p>
            )}
            {documentsError && (
              <p className={styles.error} role="alert">
                {documentsError}
              </p>
            )}
            {!documentsLoading && !documentsError && documents.length === 0 && (
              <p className={styles.credentialState}>
                Bạn chưa có giấy tờ. Tải lên giấy tờ đầu tiên để được xác minh.
              </p>
            )}
            <div className={styles.credentialList}>
              {documents.map((document) => (
                <article className={styles.credentialRow} key={document.id}>
                  <span className={styles.credentialIcon}>
                    <FileText aria-hidden="true" />
                  </span>
                  <div className={styles.credentialInfo}>
                    <strong>{document.title}</strong>
                    <span>
                      {document.issuer} · {document.issueYear}
                    </span>
                    <div className={styles.credentialMeta}>
                      <span data-status={document.verificationStatus}>
                        {document.verificationStatus === 'VERIFIED'
                          ? 'Đã xác minh'
                          : document.verificationStatus === 'REJECTED'
                            ? 'Chưa được xác minh'
                            : 'Đang chờ xác minh'}
                      </span>
                      <label className={styles.badgeToggle}>
                        <input
                          type="checkbox"
                          checked={document.badgeVisible}
                          disabled={
                            document.verificationStatus !== 'VERIFIED' ||
                            badgeBusyId === document.id
                          }
                          onChange={(event) =>
                            void setBadge(document, event.target.checked)
                          }
                        />{' '}
                        Hiện huy hiệu trên hồ sơ
                      </label>
                    </div>
                  </div>
                  <button
                    className={styles.viewCredential}
                    type="button"
                    onClick={() => {
                      setSelectedDocumentId(document.id)
                      setDocumentsOpen(true)
                    }}
                  >
                    <Eye aria-hidden="true" /> Xem
                  </button>
                </article>
              ))}
            </div>
            <p className={styles.credentialPrivacy}>
              <ShieldCheck aria-hidden="true" /> Người dùng chỉ thấy huy hiệu
              “Đã xác minh” kèm tên giấy tờ bạn bật hiển thị. Tệp gốc và số hiệu
              không được công khai.
            </p>
          </section>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className={styles.notice} role="status">
              {notice}
            </p>
          )}

          {!locked && (
            <div className={styles.actionBar}>
              <span>
                {busy
                  ? 'Đang xử lý thay đổi…'
                  : notice
                    ? 'Trạng thái hồ sơ đã được cập nhật'
                    : dirty
                      ? 'Các thay đổi chưa lưu'
                      : 'Hồ sơ đã được lưu'}
              </span>
              {amendment &&
                !['APPROVED', 'CANCELLED'].includes(amendment.status) && (
                  <button
                    type="button"
                    data-profile-ui
                    className={styles.discardButton}
                    disabled={busy}
                    onClick={() => void cancelAmendment()}
                  >
                    Hủy bản chỉnh sửa
                  </button>
                )}
              <button data-profile-ui type="submit" disabled={!canSave}>
                {busy ? 'Đang xử lý…' : 'Lưu thay đổi'}
              </button>
              <button
                type="button"
                className={styles.primary}
                data-profile-ui
                disabled={
                  busy ||
                  dirty ||
                  (status === 'APPROVED'
                    ? !amendment ||
                      !amendmentEtag ||
                      amendment.status === 'PENDING_REVIEW'
                    : !etag || status === 'PENDING_REVIEW' || status === 'NEW')
                }
                onClick={() => void submit()}
              >
                {status === 'REJECTED' || amendment?.status === 'REJECTED'
                  ? 'Gửi lại để xét duyệt'
                  : 'Gửi xét duyệt'}
              </button>
            </div>
          )}
        </form>

        <aside className={styles.previewColumn}>
          <section className={`${styles.card} ${styles.preview}`}>
            <div className={styles.previewTop}>
              <span>Xem trước hồ sơ</span>
              <span className={styles.previewStatus} data-state={status}>
                {status === 'APPROVED' ? (
                  <BadgeCheck aria-hidden="true" />
                ) : (
                  <CircleUserRound aria-hidden="true" />
                )}{' '}
                {statusTitle[status]}
              </span>
            </div>
            <div className={styles.previewAvatar} aria-hidden="true">
              {initials(form.displayName)}
            </div>
            <h2>{form.displayName || 'Tên hiển thị của bạn'}</h2>
            <p className={styles.previewRole}>Chuyên gia tâm lý</p>
            <div className={styles.previewFacts}>
              <span>
                <BriefcaseBusiness aria-hidden="true" />{' '}
                {form.yearsOfExperience} năm kinh nghiệm
              </span>
              <span>
                <Languages aria-hidden="true" /> {form.languages.length} ngôn
                ngữ
              </span>
            </div>
            <p className={styles.previewBio}>
              {form.bio || 'Phần giới thiệu của bạn sẽ hiển thị ở đây.'}
            </p>
            <div className={styles.previewTags}>
              {form.supportAreas.map((area) => (
                <span key={area}>{supportAreaLabels[area]}</span>
              ))}
              {form.languages.map((language) => (
                <span key={language}>{languageLabels[language]}</span>
              ))}
              {documents
                .filter(
                  (document) =>
                    document.verificationStatus === 'VERIFIED' &&
                    document.badgeVisible,
                )
                .map((document) => (
                  <span key={document.id}>
                    <BadgeCheck aria-hidden="true" /> {document.title}
                  </span>
                ))}
            </div>
            <div className={styles.previewPrivacy}>
              <LockKeyhole aria-hidden="true" /> Chỉ thông tin đã phê duyệt mới
              hiển thị công khai.
            </div>
          </section>

          <section className={`${styles.card} ${styles.completion}`}>
            <h2>Mức độ hoàn thiện</h2>
            <div className={styles.completionSummary}>
              <div
                className={styles.completionRing}
                style={{ '--completion': completion } as CSSProperties}
              >
                <strong>{completion}%</strong>
              </div>
              <p>Hồ sơ đầy đủ giúp người dùng tin tưởng và dễ chọn bạn hơn.</p>
            </div>
            <ul>
              {completionChecks.map((item) => (
                <li key={item.label} data-done={item.done}>
                  <i aria-hidden="true">{item.done && <Check />}</i>
                  {item.label}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      <SpecialistCredentialViewer
        open={documentsOpen}
        onClose={() => setDocumentsOpen(false)}
        documents={documents}
        selectedId={selectedDocumentId}
      />
      <SpecialistCredentialUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(document) => {
          setDocuments((current) => [document, ...current])
          showActionToast({
            title: 'Đã tải giấy tờ lên, đang chờ xác minh',
            tone: 'success',
          })
        }}
      />
    </section>
  )
}
