'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import {
  adminSafetyDirectoryApi,
  type SafetyDirectoryAdminEntry,
  type SafetyDirectoryEntryWrite,
} from '@/lib/api/admin-safety-directory'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import styles from './AdminSafetyDirectoryManager.module.css'

type FormState = {
  name: string
  type: 'FACILITY' | 'HOTLINE'
  phone: string
  address: string
  coverage: CoverageForm[]
  sourceName: string
  sourceReference: string
  sourceRetrievedAt: string
  originalSourceRetrievedAt: string | null
  originalSourceRetrievedAtLocal: string
  sourceChecksum: string
}

type CoverageForm = {
  level: 'NATIONWIDE' | 'PROVINCE' | 'DISTRICT'
  provinceCode: string
  provinceName: string
  districtCode: string
  districtName: string
}

type EditableTextKey = Exclude<
  keyof FormState,
  'coverage' | 'originalSourceRetrievedAt' | 'originalSourceRetrievedAtLocal'
>

const blankCoverage = (): CoverageForm => ({
  level: 'NATIONWIDE',
  provinceCode: '',
  provinceName: '',
  districtCode: '',
  districtName: '',
})

export function toLocalDateTimeValue(instant: string) {
  const date = new Date(instant)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

const blankForm = (): FormState => ({
  name: '',
  type: 'HOTLINE',
  phone: '',
  address: '',
  coverage: [blankCoverage()],
  sourceName: '',
  sourceReference: '',
  sourceRetrievedAt: '',
  originalSourceRetrievedAt: null,
  originalSourceRetrievedAtLocal: '',
  sourceChecksum: '',
})

const statusCopy: Record<SafetyDirectoryAdminEntry['reviewState'], string> = {
  UNREVIEWED: 'Chờ duyệt',
  CURRENT: 'Đã xác minh',
  STALE: 'Cần xác minh lại',
  INACTIVE: 'Ngừng hoạt động',
}

function toForm(entry: SafetyDirectoryAdminEntry): FormState {
  const sourceRetrievedAt = toLocalDateTimeValue(entry.sourceRetrievedAt)
  return {
    name: entry.name,
    type: entry.type,
    phone: entry.phone,
    address: entry.address ?? '',
    coverage: entry.coverage.map((coverage) => ({
      level: coverage.level,
      provinceCode: coverage.provinceCode ?? '',
      provinceName: coverage.provinceName ?? '',
      districtCode: coverage.districtCode ?? '',
      districtName: coverage.districtName ?? '',
    })),
    sourceName: entry.sourceName,
    sourceReference: entry.sourceReference,
    sourceRetrievedAt,
    originalSourceRetrievedAt: entry.sourceRetrievedAt,
    originalSourceRetrievedAtLocal: sourceRetrievedAt,
    sourceChecksum: entry.sourceChecksum ?? '',
  }
}

function payload(form: FormState): SafetyDirectoryEntryWrite {
  const local = form.sourceRetrievedAt ? new Date(form.sourceRetrievedAt) : null
  if (
    !form.name.trim() ||
    !form.phone.trim() ||
    !form.sourceName.trim() ||
    !form.sourceReference.trim() ||
    !local ||
    Number.isNaN(local.getTime())
  )
    throw new Error(
      'Vui lòng điền đủ tên, số liên hệ, nguồn và thời điểm truy xuất.',
    )
  if (form.type === 'FACILITY' && !form.address.trim())
    throw new Error('Cơ sở hỗ trợ phải có địa chỉ.')
  if (form.coverage.length === 0 || form.coverage.length > 100)
    throw new Error('Phạm vi phải có từ 1 đến 100 khu vực.')
  for (const coverage of form.coverage) {
    if (
      coverage.level !== 'NATIONWIDE' &&
      (!coverage.provinceCode.trim() || !coverage.provinceName.trim())
    )
      throw new Error('Phạm vi địa phương phải có mã và tên tỉnh/thành.')
    if (
      coverage.level === 'DISTRICT' &&
      (!coverage.districtCode.trim() || !coverage.districtName.trim())
    )
      throw new Error('Phạm vi quận/huyện phải có mã và tên quận/huyện.')
  }
  if (form.sourceChecksum && !/^[a-f0-9]{64}$/i.test(form.sourceChecksum))
    throw new Error('Checksum SHA-256 phải có đúng 64 ký tự hex.')
  return {
    name: form.name.trim(),
    type: form.type,
    phone: form.phone.trim(),
    address: form.address.trim() || null,
    coverage: form.coverage.map((coverage) => ({
      level: coverage.level,
      provinceCode:
        coverage.level === 'NATIONWIDE' ? null : coverage.provinceCode.trim(),
      provinceName:
        coverage.level === 'NATIONWIDE' ? null : coverage.provinceName.trim(),
      districtCode:
        coverage.level === 'DISTRICT' ? coverage.districtCode.trim() : null,
      districtName:
        coverage.level === 'DISTRICT' ? coverage.districtName.trim() : null,
    })),
    sourceName: form.sourceName.trim(),
    sourceReference: form.sourceReference.trim(),
    sourceRetrievedAt:
      form.originalSourceRetrievedAt &&
      form.sourceRetrievedAt === form.originalSourceRetrievedAtLocal
        ? form.originalSourceRetrievedAt
        : local.toISOString(),
    sourceChecksum: form.sourceChecksum.trim() || null,
  }
}

function displayError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403)
      return 'Bạn không có quyền quản trị thư mục an toàn.'
    if (error.status === 409)
      return 'Bản ghi đã thay đổi. Dữ liệu mới nhất đã được tải lại; hãy kiểm tra trước khi thao tác lại.'
    if (error.code === 'REQUEST_TIMEOUT' || error.status === 503)
      return 'Kết quả tạo chưa xác định. Hãy bấm Lưu để đối soát bằng cùng mã lệnh, hoặc Hủy để bỏ draft này trước khi bắt đầu yêu cầu mới.'
    return `${error.message}${error.correlationId ? ` (mã đối soát: ${error.correlationId})` : ''}`
  }
  return error instanceof Error ? error.message : 'Không thể hoàn tất thao tác.'
}

function isAuthorizationFailure(error: unknown) {
  return (
    error instanceof ApiError && (error.status === 401 || error.status === 403)
  )
}

export default function AdminSafetyDirectoryManager() {
  const feedback = useFeedback()
  const cancelConfirm = feedback.cancelConfirm
  const [entries, setEntries] = useState<SafetyDirectoryAdminEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<
    'ALL' | SafetyDirectoryAdminEntry['reviewState']
  >('ALL')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<'create' | 'update' | null>(null)
  const [access, setAccess] = useState<'unknown' | 'authorized' | 'denied'>(
    'unknown',
  )
  const [form, setForm] = useState<FormState>(blankForm)
  const createCommand = useRef<{ fingerprint: string; key: string } | null>(
    null,
  )
  const loadGeneration = useRef(0)

  const revokePrivilegedState = useCallback(() => {
    loadGeneration.current += 1
    setEntries([])
    setSelectedId(null)
    setEditing(null)
    setBusy(false)
    setLoading(false)
    setAccess('denied')
    createCommand.current = null
    cancelConfirm()
  }, [cancelConfirm])

  const load = useCallback(
    async (retainSelection = true) => {
      const generation = loadGeneration.current + 1
      loadGeneration.current = generation
      setLoading(true)
      setError(null)
      try {
        const next = await adminSafetyDirectoryApi.list()
        if (loadGeneration.current !== generation) return
        setAccess('authorized')
        setEntries(next)
        setSelectedId((current) =>
          retainSelection &&
          next.some((item) => item.directoryEntryId === current)
            ? current
            : (next[0]?.directoryEntryId ?? null),
        )
      } catch (reason) {
        if (loadGeneration.current !== generation) return
        if (isAuthorizationFailure(reason)) revokePrivilegedState()
        setError(displayError(reason))
      } finally {
        if (loadGeneration.current === generation) setLoading(false)
      }
    },
    [revokePrivilegedState],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(false), 0)
    return () => window.clearTimeout(timer)
  }, [load])
  const selected =
    entries.find((entry) => entry.directoryEntryId === selectedId) ?? null
  const filtered = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (filter === 'ALL' || entry.reviewState === filter) &&
          `${entry.name} ${entry.phone} ${entry.sourceName}`
            .toLocaleLowerCase('vi')
            .includes(query.trim().toLocaleLowerCase('vi')),
      ),
    [entries, filter, query],
  )

  const change = (key: EditableTextKey, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))
  const changeCoverage = (
    index: number,
    key: keyof CoverageForm,
    value: string,
  ) =>
    setForm((current) => ({
      ...current,
      coverage: current.coverage.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item,
      ),
    }))
  const addCoverage = () =>
    setForm((current) =>
      current.coverage.length >= 100
        ? current
        : { ...current, coverage: [...current.coverage, blankCoverage()] },
    )
  const removeCoverage = (index: number) =>
    setForm((current) => ({
      ...current,
      coverage: current.coverage.filter((_, itemIndex) => itemIndex !== index),
    }))
  const beginCreate = () => {
    if (access !== 'authorized') return
    createCommand.current = null
    setForm(blankForm())
    setEditing('create')
    setError(null)
  }
  const beginUpdate = () => {
    if (access === 'authorized' && selected) {
      createCommand.current = null
      setForm(toForm(selected))
      setEditing('update')
      setError(null)
    }
  }

  async function save() {
    if (access !== 'authorized') return
    let body: SafetyDirectoryEntryWrite
    try {
      body = payload(form)
    } catch (reason) {
      setError(displayError(reason))
      return
    }
    if (editing === 'update' && selected) {
      const confirmed = await feedback.confirm({
        title: 'Lưu thay đổi và yêu cầu duyệt lại?',
        description:
          'Chỉnh sửa sẽ làm mất hiệu lực xác minh hiện tại. Bản ghi chỉ được hiển thị công khai sau khi được duyệt lại.',
        confirmLabel: 'Lưu thay đổi',
        tone: 'danger',
      })
      if (!confirmed) return
      if (access !== 'authorized') return
    }
    setBusy(true)
    setError(null)
    try {
      const fingerprint = JSON.stringify(body)
      if (
        !createCommand.current ||
        createCommand.current.fingerprint !== fingerprint
      )
        createCommand.current = { fingerprint, key: crypto.randomUUID() }
      const saved =
        editing === 'update' && selected
          ? await adminSafetyDirectoryApi.update(selected, body)
          : await adminSafetyDirectoryApi.create(
              body,
              createCommand.current.key,
            )
      setEntries((current) => [
        saved,
        ...current.filter(
          (item) => item.directoryEntryId !== saved.directoryEntryId,
        ),
      ])
      setSelectedId(saved.directoryEntryId)
      setEditing(null)
      createCommand.current = null
      feedback.showActionToast({
        title: editing === 'update' ? 'Đã lưu bản ghi' : 'Đã tạo bản ghi',
        description: 'Trạng thái authoritative đã được cập nhật.',
        tone: 'success',
      })
    } catch (reason) {
      if (isAuthorizationFailure(reason)) revokePrivilegedState()
      else if (reason instanceof ApiError && reason.status === 409) await load()
      setError(displayError(reason))
    } finally {
      setBusy(false)
    }
  }

  async function transition(action: 'review' | 'deactivate') {
    if (access !== 'authorized' || !selected) return
    const confirmed = await feedback.confirm({
      title:
        action === 'review'
          ? 'Xác nhận nguồn và kích hoạt?'
          : 'Ngừng hiển thị bản ghi này?',
      description:
        action === 'review'
          ? 'Bạn xác nhận đã đối chiếu nguồn, số liên hệ và phạm vi của đúng phiên bản này.'
          : 'Bản ghi sẽ bị loại khỏi thư mục công khai nhưng lịch sử kiểm toán vẫn được giữ.',
      confirmLabel:
        action === 'review' ? 'Duyệt và kích hoạt' : 'Ngừng kích hoạt',
      tone: 'danger',
    })
    if (!confirmed) return
    if (access !== 'authorized') return
    setBusy(true)
    setError(null)
    try {
      const saved = await adminSafetyDirectoryApi.transition(selected, action)
      setEntries((current) =>
        current.map((item) =>
          item.directoryEntryId === saved.directoryEntryId ? saved : item,
        ),
      )
      feedback.showActionToast({
        title:
          action === 'review' ? 'Đã xác minh bản ghi' : 'Đã ngừng kích hoạt',
        tone: 'success',
      })
    } catch (reason) {
      if (isAuthorizationFailure(reason)) revokePrivilegedState()
      else if (reason instanceof ApiError && reason.status === 409) await load()
      setError(displayError(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.shell} aria-labelledby="safety-directory-title">
      <header className={styles.hero}>
        <div>
          <h1 id="safety-directory-title">Thư mục hỗ trợ an toàn</h1>
          <p>
            Quản lý các số liên hệ và cơ sở đã được đối chiếu nguồn. Chỉ bản ghi
            đang hoạt động, đúng phiên bản đã xác minh mới xuất hiện cho người
            dùng.
          </p>
        </div>
        {access === 'authorized' && (
          <div className={styles.actions}>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => void load()}
              disabled={loading || busy}
            >
              Làm mới
            </button>
            <button
              className={styles.primary}
              type="button"
              onClick={beginCreate}
            >
              Thêm bản ghi
            </button>
          </div>
        )}
      </header>
      {error && (
        <div className={styles.error} role="alert">
          {error}{' '}
          <button
            type="button"
            className={styles.secondary}
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </div>
      )}
      <div className={styles.toolbar} aria-label="Bộ lọc thư mục">
        <input
          aria-label="Tìm theo tên, số liên hệ hoặc nguồn"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm tên, số liên hệ hoặc nguồn…"
        />
        <select
          aria-label="Lọc theo trạng thái"
          value={filter}
          onChange={(event) => setFilter(event.target.value as typeof filter)}
        >
          <option value="ALL">Tất cả trạng thái</option>
          {Object.entries(statusCopy).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Danh sách authoritative ({filtered.length})</h2>
          </div>
          {loading ? (
            <div className={styles.state} role="status">
              Đang tải dữ liệu đã xác minh…
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.state}>Không có bản ghi phù hợp.</div>
          ) : (
            <ul className={styles.list}>
              {filtered.map((entry) => (
                <li key={entry.directoryEntryId}>
                  <button
                    type="button"
                    className={`${styles.itemButton} ${entry.directoryEntryId === selectedId ? styles.selected : ''}`}
                    onClick={() => {
                      createCommand.current = null
                      setSelectedId(entry.directoryEntryId)
                      setEditing(null)
                    }}
                    aria-pressed={entry.directoryEntryId === selectedId}
                  >
                    <span className={styles.itemTitle}>
                      <span>{entry.name}</span>
                      <span className={styles.badge}>
                        {statusCopy[entry.reviewState]}
                      </span>
                    </span>
                    <span className={styles.meta}>
                      <span>
                        {entry.type === 'HOTLINE'
                          ? 'Đường dây hỗ trợ'
                          : 'Cơ sở'}
                      </span>
                      <span>v{entry.recordVersion}</span>
                      <span>{entry.phone}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.panel}>
          {editing ? (
            <EntryForm
              form={form}
              change={change}
              changeCoverage={changeCoverage}
              addCoverage={addCoverage}
              removeCoverage={removeCoverage}
              busy={busy}
              editing={editing}
              onSave={() => void save()}
              onCancel={() => {
                createCommand.current = null
                setEditing(null)
              }}
            />
          ) : selected ? (
            <div className={styles.detail}>
              <div>
                <span className={styles.badge}>
                  {statusCopy[selected.reviewState]}
                </span>
                <h2>{selected.name}</h2>
              </div>
              <div className={styles.facts}>
                <Fact label="Số liên hệ" value={selected.phone} />
                <Fact
                  label="Loại"
                  value={
                    selected.type === 'HOTLINE'
                      ? 'Đường dây hỗ trợ'
                      : 'Cơ sở hỗ trợ'
                  }
                />
                <Fact
                  label="Địa chỉ"
                  value={selected.address ?? 'Không áp dụng'}
                />
                <Fact
                  label="Phạm vi"
                  value={selected.coverage
                    .map(
                      (item) =>
                        item.districtName ?? item.provinceName ?? 'Toàn quốc',
                    )
                    .join(', ')}
                />
                <Fact label="Nguồn" value={selected.sourceName} />
                <Fact
                  label="Tham chiếu nguồn"
                  value={selected.sourceReference}
                />
                <Fact
                  label="Truy xuất nguồn"
                  value={new Date(selected.sourceRetrievedAt).toLocaleString(
                    'vi-VN',
                  )}
                />
                <Fact
                  label="Phiên bản / cập nhật"
                  value={`v${selected.recordVersion} · ${new Date(selected.updatedAt).toLocaleString('vi-VN')}`}
                />
                <Fact
                  label="Người duyệt"
                  value={selected.reviewedBy ?? 'Chưa duyệt'}
                />
                <Fact
                  label="Người xác minh"
                  value={selected.verifiedBy ?? 'Chưa xác minh'}
                />
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.secondary}
                  type="button"
                  onClick={beginUpdate}
                  disabled={busy}
                >
                  Chỉnh sửa
                </button>
                <button
                  className={styles.primary}
                  type="button"
                  onClick={() => void transition('review')}
                  disabled={busy || selected.reviewState === 'CURRENT'}
                >
                  Duyệt và kích hoạt
                </button>
                <button
                  className={styles.danger}
                  type="button"
                  onClick={() => void transition('deactivate')}
                  disabled={busy || !selected.active}
                >
                  Ngừng kích hoạt
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.state}>
              Chọn một bản ghi để xem chi tiết.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <strong>{label}</strong>
      {value}
    </div>
  )
}

function EntryForm({
  form,
  change,
  changeCoverage,
  addCoverage,
  removeCoverage,
  busy,
  editing,
  onSave,
  onCancel,
}: {
  form: FormState
  change: (key: EditableTextKey, value: string) => void
  changeCoverage: (
    index: number,
    key: keyof CoverageForm,
    value: string,
  ) => void
  addCoverage: () => void
  removeCoverage: (index: number) => void
  busy: boolean
  editing: 'create' | 'update'
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
    >
      <h2>
        {editing === 'create' ? 'Thêm bản ghi nguồn' : 'Chỉnh sửa bản ghi'}
      </h2>
      <p className={styles.hint}>
        Không nhập dữ liệu cá nhân của người dùng. Tất cả trường nguồn dùng cho
        kiểm toán và xác minh.
      </p>
      <div className={styles.fields}>
        <Field
          label="Tên bản ghi"
          value={form.name}
          onChange={(value) => change('name', value)}
          required
        />
        <label className={styles.field}>
          Loại
          <select
            value={form.type}
            onChange={(event) => change('type', event.target.value)}
          >
            <option value="HOTLINE">Đường dây hỗ trợ</option>
            <option value="FACILITY">Cơ sở hỗ trợ</option>
          </select>
        </label>
        <Field
          label="Số liên hệ"
          value={form.phone}
          onChange={(value) => change('phone', value)}
          required
        />
        <Field
          label="Địa chỉ"
          value={form.address}
          onChange={(value) => change('address', value)}
          required={form.type === 'FACILITY'}
        />
        <div className={`${styles.coverageEditor} ${styles.wide}`}>
          <div className={styles.coverageHeader}>
            <strong>Phạm vi phục vụ ({form.coverage.length})</strong>
            <button
              className={styles.secondary}
              type="button"
              onClick={addCoverage}
              disabled={busy || form.coverage.length >= 100}
            >
              Thêm phạm vi
            </button>
          </div>
          {form.coverage.map((coverage, index) => (
            <fieldset className={styles.coverageGroup} key={index}>
              <legend>Phạm vi {index + 1}</legend>
              <label className={styles.field}>
                Mức phạm vi {index + 1}
                <select
                  value={coverage.level}
                  onChange={(event) =>
                    changeCoverage(index, 'level', event.target.value)
                  }
                >
                  <option value="NATIONWIDE">Toàn quốc</option>
                  <option value="PROVINCE">Tỉnh/thành</option>
                  <option value="DISTRICT">Quận/huyện</option>
                </select>
              </label>
              {coverage.level !== 'NATIONWIDE' && (
                <>
                  <Field
                    label={`Mã tỉnh/thành ${index + 1}`}
                    value={coverage.provinceCode}
                    onChange={(value) =>
                      changeCoverage(index, 'provinceCode', value)
                    }
                    required
                  />
                  <Field
                    label={`Tên tỉnh/thành ${index + 1}`}
                    value={coverage.provinceName}
                    onChange={(value) =>
                      changeCoverage(index, 'provinceName', value)
                    }
                    required
                  />
                </>
              )}
              {coverage.level === 'DISTRICT' && (
                <>
                  <Field
                    label={`Mã quận/huyện ${index + 1}`}
                    value={coverage.districtCode}
                    onChange={(value) =>
                      changeCoverage(index, 'districtCode', value)
                    }
                    required
                  />
                  <Field
                    label={`Tên quận/huyện ${index + 1}`}
                    value={coverage.districtName}
                    onChange={(value) =>
                      changeCoverage(index, 'districtName', value)
                    }
                    required
                  />
                </>
              )}
              {form.coverage.length > 1 && (
                <button
                  className={styles.danger}
                  type="button"
                  onClick={() => removeCoverage(index)}
                  disabled={busy}
                >
                  Xóa phạm vi {index + 1}
                </button>
              )}
            </fieldset>
          ))}
        </div>
        <Field
          label="Tên nguồn"
          value={form.sourceName}
          onChange={(value) => change('sourceName', value)}
          required
        />
        <label className={styles.field}>
          Thời điểm truy xuất nguồn
          <input
            type="datetime-local"
            value={form.sourceRetrievedAt}
            onChange={(event) =>
              change('sourceRetrievedAt', event.target.value)
            }
            required
          />
        </label>
        <label className={`${styles.field} ${styles.wide}`}>
          Tham chiếu nguồn
          <textarea
            value={form.sourceReference}
            onChange={(event) => change('sourceReference', event.target.value)}
            required
          />
        </label>
        <Field
          label="Checksum SHA-256 (không bắt buộc)"
          value={form.sourceChecksum}
          onChange={(value) => change('sourceChecksum', value)}
          wide
        />
      </div>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu bản ghi'}
        </button>
        <button
          className={styles.secondary}
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          Hủy
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  required = false,
  wide = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  wide?: boolean
}) {
  return (
    <label className={`${styles.field} ${wide ? styles.wide : ''}`}>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  )
}
