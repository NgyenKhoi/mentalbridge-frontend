'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  BenchmarkCase,
  BenchmarkDataset,
  BenchmarkRun,
} from '@/lib/benchmarks/benchmark-contract'
import { benchmarkApi } from './benchmark-api'
import { parseBenchmarkCasesText } from './benchmark-validation'
import styles from './AdminBenchmarkGovernance.module.css'

const sampleCase: BenchmarkCase = {
  id: 'synthetic-case-1',
  text: 'Tình huống tổng hợp không chứa dữ liệu của người dùng thật.',
  acceptableSuggestedActions: ['NONE'],
  requiredSignalTerms: ['tổng hợp'],
  forbiddenClaims: ['chẩn đoán'],
}

function formatInstant(value: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : '—'
}

export default function AdminBenchmarkGovernance() {
  const [datasets, setDatasets] = useState<BenchmarkDataset[]>([])
  const [runs, setRuns] = useState<BenchmarkRun[]>([])
  const [selected, setSelected] = useState<BenchmarkDataset | null>(null)
  const [cases, setCases] = useState<readonly BenchmarkCase[]>([sampleCase])
  const [casesText, setCasesText] = useState(
    JSON.stringify([sampleCase], null, 2),
  )
  const [casesError, setCasesError] = useState('')
  const [datasetId, setDatasetId] = useState('')
  const [version, setVersion] = useState('v1')
  const [description, setDescription] = useState('')
  const [approvalId, setApprovalId] = useState('')
  const [approvedBy, setApprovedBy] = useState('')
  const [approvedAt, setApprovedAt] = useState('')
  const [contentSha256, setContentSha256] = useState('')
  const [provider, setProvider] = useState<'GEMINI' | 'OPENAI' | 'BEDROCK'>(
    'GEMINI',
  )
  const [model, setModel] = useState('gemini-2.5-flash')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [archiveCandidate, setArchiveCandidate] =
    useState<BenchmarkDataset | null>(null)
  const mounted = useRef(true)
  const commandKeys = useRef(
    new Map<string, { fingerprint: string; key: string }>(),
  )

  const keyFor = (action: string, payload: unknown) => {
    const fingerprint = JSON.stringify(payload)
    const current = commandKeys.current.get(action)
    if (current?.fingerprint === fingerprint) return current.key
    const key = crypto.randomUUID()
    commandKeys.current.set(action, { fingerprint, key })
    return key
  }
  const complete = (action: string) => commandKeys.current.delete(action)

  const load = useCallback(async () => {
    try {
      const [nextDatasets, nextRuns] = await Promise.all([
        benchmarkApi.datasets(),
        benchmarkApi.runs(),
      ])
      setDatasets(nextDatasets)
      setRuns(nextRuns)
      setSelected((current) => {
        if (!current) return null
        const refreshed = nextDatasets.find(
          (item) =>
            item.datasetId === current.datasetId &&
            item.version === current.version,
        )
        return refreshed ? { ...current, ...refreshed } : null
      })
      setError('')
    } catch (cause) {
      setDatasets([])
      setRuns([])
      setSelected(null)
      setError(
        cause instanceof Error
          ? cause.message
          : 'Không thể tải dữ liệu đánh giá.',
      )
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      mounted.current = false
      window.clearTimeout(timer)
    }
  }, [load])

  const inspect = async (item: BenchmarkDataset) => {
    setBusy(true)
    try {
      const detail = await benchmarkApi.dataset(item.datasetId, item.version)
      setSelected(detail)
      setCases(detail.cases)
      setCasesText(JSON.stringify(detail.cases, null, 2))
      setCasesError('')
      setDatasetId(detail.datasetId)
      setDescription(detail.description)
      setApprovalId(detail.privacyApproval.approvalId)
      setApprovedBy(detail.privacyApproval.approvedBy)
      setApprovedAt(detail.privacyApproval.approvedAt)
      setContentSha256(detail.privacyApproval.contentSha256)
      setVersion(
        `v${Number.parseInt(detail.version.replace(/\D/g, ''), 10) + 1 || 2}`,
      )
      setError('')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể mở phiên bản.',
      )
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    const action = selected ? `version:${selected.datasetId}` : 'create'
    const privacyApproval = {
      registry: 'MB369_CURATED_REGISTRY' as const,
      approvalId,
      approvedBy,
      approvedAt,
      contentSha256,
    }
    const versionPayload = { version, description, cases, privacyApproval }
    const createPayload = {
      datasetId,
      version,
      workload: 'EXACT_REVISION' as const,
      language: 'vi' as const,
      source: 'MENTALBRIDGE_SYNTHETIC_V1' as const,
      license: 'CC0-1.0' as const,
      description,
      cases,
      privacyApproval,
    }
    setBusy(true)
    try {
      if (selected) {
        await benchmarkApi.createVersion(
          selected.datasetId,
          selected.version,
          versionPayload,
          keyFor(action, versionPayload),
        )
      } else {
        await benchmarkApi.create(createPayload, keyFor(action, createPayload))
      }
      complete(action)
      setNotice(
        selected
          ? 'Đã tạo phiên bản bất biến mới.'
          : 'Đã tạo bộ dữ liệu tổng hợp.',
      )
      setSelected(null)
      setDatasetId('')
      setDescription('')
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể lưu bộ dữ liệu.',
      )
    } finally {
      setBusy(false)
    }
  }

  const archive = async (item: BenchmarkDataset) => {
    const action = `archive:${item.datasetId}:${item.version}`
    const payload = { datasetId: item.datasetId, version: item.version }
    setBusy(true)
    try {
      const archived = await benchmarkApi.archive(
        item.datasetId,
        item.version,
        keyFor(action, payload),
      )
      complete(action)
      setArchiveCandidate(null)
      setDatasets((current) =>
        current.map((candidate) =>
          candidate.datasetId === archived.datasetId &&
          candidate.version === archived.version
            ? archived
            : candidate,
        ),
      )
      setSelected((current) =>
        current?.datasetId === archived.datasetId &&
        current.version === archived.version
          ? { ...current, ...archived }
          : current,
      )
      setNotice('Đã lưu trữ phiên bản; lịch sử kiểm toán vẫn được giữ lại.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu trữ.')
    } finally {
      setBusy(false)
    }
  }

  const reconcileRun = async (accepted: BenchmarkRun, action: string) => {
    let current = accepted
    for (let attempt = 0; attempt < 60 && mounted.current; attempt += 1) {
      if (current.status !== 'RUNNING') {
        complete(action)
        const successful = current.aggregates.reduce(
          (total, aggregate) => total + aggregate.successCount,
          0,
        )
        if (current.status === 'COMPLETED' && successful > 0) {
          setNotice('Benchmark đã hoàn tất với provenance và rubric được ghim.')
          setError('')
        } else {
          setNotice('')
          setError(
            current.failureClassification === 'ALL_CASES_PROVIDER_FAILED'
              ? 'Benchmark thất bại: tất cả provider đều không tạo được kết quả đánh giá.'
              : 'Benchmark kết thúc ở trạng thái FAILED; không ghi nhận đây là phép đo chất lượng thành công.',
          )
        }
        return
      }
      if (attempt > 0)
        await new Promise((resolve) => window.setTimeout(resolve, 1_000))
      try {
        current = await benchmarkApi.runDetail(current.runId)
        if (!mounted.current) return
        setRuns((items) => [
          current,
          ...items.filter((item) => item.runId !== current.runId),
        ])
      } catch {
        setNotice(
          'Benchmark vẫn đang được đối soát; giữ nguyên mã lệnh để thử lại an toàn.',
        )
        return
      }
    }
  }

  const run = async () => {
    if (!selected) return
    const action = `run:${selected.datasetId}:${selected.version}:${provider}:${model}`
    const payload = {
      datasetId: selected.datasetId,
      datasetVersion: selected.version,
      provider,
      model,
    }
    setBusy(true)
    try {
      const accepted = await benchmarkApi.run(payload, keyFor(action, payload))
      setRuns((current) => [
        accepted,
        ...current.filter((item) => item.runId !== accepted.runId),
      ])
      setNotice(
        'Benchmark đã được tiếp nhận; đang đối soát trạng thái có thẩm quyền.',
      )
      setError('')
      void reconcileRun(accepted, action)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `${cause.message}. Trạng thái có thể chưa rõ; hãy tải lại để đối soát.`
          : 'Trạng thái benchmark chưa rõ; hãy tải lại để đối soát.',
      )
    } finally {
      setBusy(false)
    }
  }

  const exportRun = async (item: BenchmarkRun) => {
    try {
      const result = await benchmarkApi.exportRun(item.runId)
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `benchmark-${item.runId}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice('Đã xuất báo cáo tổng hợp không chứa input/output cá nhân.')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể xuất báo cáo.',
      )
    }
  }

  return (
    <section className={styles.shell} aria-labelledby="benchmark-title">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>AI governance · synthetic only</p>
          <h1 id="benchmark-title">Bộ dữ liệu & benchmark AI</h1>
          <p>
            Quản trị phiên bản bất biến và báo cáo tổng hợp, không dùng dữ liệu
            thật.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy}>
          Tải lại
        </button>
      </header>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="datasets-title">
          <h2 id="datasets-title">Danh mục đã phê duyệt</h2>
          <div className={styles.list}>
            {datasets.map((item) => (
              <article
                key={`${item.datasetId}:${item.version}`}
                className={styles.item}
              >
                <button
                  type="button"
                  onClick={() => void inspect(item)}
                  disabled={busy}
                >
                  <strong>{item.datasetId}</strong> <span>{item.version}</span>
                </button>
                <small>
                  {item.caseCount} ca · SHA {item.sha256.slice(0, 12)}…
                </small>
                <small>
                  {item.archivedAt
                    ? `Lưu trữ ${formatInstant(item.archivedAt)}`
                    : 'Có thể chạy'}
                </small>
                {!item.archivedAt && (
                  <button
                    type="button"
                    onClick={() => setArchiveCandidate(item)}
                    disabled={busy}
                  >
                    Lưu trữ
                  </button>
                )}
              </article>
            ))}
            {datasets.length === 0 && <p>Chưa có bộ dữ liệu được quản trị.</p>}
          </div>
        </section>

        <section className={styles.card} aria-labelledby="editor-title">
          <h2 id="editor-title">
            {selected
              ? `Tạo phiên bản mới từ ${selected.version}`
              : 'Tạo bộ dữ liệu tổng hợp'}
          </h2>
          <label>
            Mã bộ dữ liệu
            <input
              value={datasetId}
              disabled={Boolean(selected)}
              onChange={(event) => setDatasetId(event.target.value)}
            />
          </label>
          <label>
            Phiên bản
            <input
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </label>
          <label>
            Mô tả
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Ca kiểm thử (JSON)
            <textarea
              rows={9}
              value={casesText}
              onChange={(event) => {
                const raw = event.target.value
                setCasesText(raw)
                try {
                  setCases(parseBenchmarkCasesText(raw))
                  setCasesError('')
                } catch (cause) {
                  setCasesError(
                    cause instanceof Error
                      ? cause.message
                      : 'BENCHMARK_CASES_INVALID_SCHEMA',
                  )
                }
              }}
            />
          </label>
          {casesError && <p role="alert">{casesError}</p>}
          <label>
            Mã phê duyệt dữ liệu tổng hợp
            <input
              value={approvalId}
              onChange={(event) => setApprovalId(event.target.value)}
            />
          </label>
          <label>
            Người phê duyệt
            <input
              value={approvedBy}
              onChange={(event) => setApprovedBy(event.target.value)}
            />
          </label>
          <label>
            Thời điểm phê duyệt (ISO)
            <input
              value={approvedAt}
              onChange={(event) => setApprovedAt(event.target.value)}
            />
          </label>
          <label>
            SHA-256 nội dung đã phê duyệt
            <input
              value={contentSha256}
              onChange={(event) => setContentSha256(event.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => void save()}
              disabled={
                busy ||
                !datasetId ||
                !description ||
                Boolean(casesError) ||
                cases.length === 0 ||
                !approvalId ||
                !approvedBy ||
                !approvedAt ||
                !/^[0-9a-f]{64}$/.test(contentSha256)
              }
            >
              Lưu bất biến
            </button>
            {selected && (
              <button
                type="button"
                onClick={() => {
                  commandKeys.current.delete(`version:${selected.datasetId}`)
                  setSelected(null)
                }}
              >
                Hủy
              </button>
            )}
          </div>
        </section>
      </div>

      {archiveCandidate && (
        <section className={styles.card} role="dialog" aria-modal="true">
          <h2>Xác nhận lưu trữ</h2>
          <p>
            Lưu trữ {archiveCandidate.datasetId} · {archiveCandidate.version}?
            Phiên bản sẽ không thể chạy benchmark mới.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => void archive(archiveCandidate)}
              disabled={busy}
            >
              Xác nhận lưu trữ
            </button>
            <button
              type="button"
              onClick={() => setArchiveCandidate(null)}
              disabled={busy}
            >
              Hủy
            </button>
          </div>
        </section>
      )}

      <section className={styles.card} aria-labelledby="run-title">
        <h2 id="run-title">Chạy benchmark được ghim</h2>
        <p>
          {selected
            ? `${selected.datasetId} · ${selected.version} · ${selected.sha256}`
            : 'Chọn một phiên bản chưa lưu trữ ở danh mục.'}
        </p>
        <div className={styles.actions}>
          <label>
            Provider
            <select
              value={provider}
              onChange={(event) =>
                setProvider(event.target.value as typeof provider)
              }
            >
              <option>GEMINI</option>
              <option>OPENAI</option>
              <option>BEDROCK</option>
            </select>
          </label>
          <label>
            Model
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy || !selected || Boolean(selected.archivedAt)}
          >
            Chạy benchmark
          </button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="history-title">
        <h2 id="history-title">Lịch sử & provenance</h2>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Dataset</th>
                <th>Model</th>
                <th>Kết quả</th>
                <th>Xuất</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((item) => (
                <tr key={item.runId}>
                  <td>{formatInstant(item.startedAt)}</td>
                  <td>
                    {item.datasetId} {item.datasetVersion}
                    <br />
                    <small>{item.datasetSha256.slice(0, 12)}…</small>
                  </td>
                  <td>
                    {item.candidates
                      .map(
                        (candidate) =>
                          `${candidate.provider}/${candidate.model}`,
                      )
                      .join(', ')}
                  </td>
                  <td>
                    {item.status}
                    {item.aggregates[0]
                      ? ` · quality ${Math.round(item.aggregates[0].qualityPassRate * 100)}% · safety ${Math.round(item.aggregates[0].safetyPassRate * 100)}%`
                      : ''}
                  </td>
                  <td>
                    <button type="button" onClick={() => void exportRun(item)}>
                      JSON tổng hợp
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}
