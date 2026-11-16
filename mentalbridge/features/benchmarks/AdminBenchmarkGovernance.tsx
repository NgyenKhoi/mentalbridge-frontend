'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  BenchmarkCase,
  BenchmarkDataset,
  BenchmarkRun,
} from '@/lib/benchmarks/benchmark-contract'
import { benchmarkApi } from './benchmark-api'
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
  const [datasetId, setDatasetId] = useState('')
  const [version, setVersion] = useState('v1')
  const [description, setDescription] = useState('')
  const [provider, setProvider] = useState<'GEMINI' | 'OPENAI' | 'BEDROCK'>(
    'GEMINI',
  )
  const [model, setModel] = useState('gemini-2.5-flash')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const commandKeys = useRef(new Map<string, string>())

  const keyFor = (action: string) => {
    const current = commandKeys.current.get(action)
    if (current) return current
    const key = crypto.randomUUID()
    commandKeys.current.set(action, key)
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
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const inspect = async (item: BenchmarkDataset) => {
    setBusy(true)
    try {
      const detail = await benchmarkApi.dataset(item.datasetId, item.version)
      setSelected(detail)
      setCases(detail.cases)
      setDatasetId(detail.datasetId)
      setDescription(detail.description)
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
    setBusy(true)
    try {
      if (selected) {
        await benchmarkApi.createVersion(
          selected.datasetId,
          selected.version,
          { version, description, cases },
          keyFor(action),
        )
      } else {
        await benchmarkApi.create(
          {
            datasetId,
            version,
            workload: 'EXACT_REVISION',
            language: 'vi',
            source: 'MENTALBRIDGE_SYNTHETIC_V1',
            license: 'CC0-1.0',
            description,
            cases,
          },
          keyFor(action),
        )
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
    setBusy(true)
    try {
      await benchmarkApi.archive(item.datasetId, item.version, keyFor(action))
      complete(action)
      setNotice('Đã lưu trữ phiên bản; lịch sử kiểm toán vẫn được giữ lại.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu trữ.')
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    if (!selected) return
    const action = `run:${selected.datasetId}:${selected.version}:${provider}:${model}`
    setBusy(true)
    try {
      await benchmarkApi.run(
        {
          datasetId: selected.datasetId,
          datasetVersion: selected.version,
          provider,
          model,
        },
        keyFor(action),
      )
      complete(action)
      setNotice('Benchmark đã hoàn tất với provenance được ghim chính xác.')
      await load()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Benchmark thất bại an toàn.',
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
                    onClick={() => void archive(item)}
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
              value={JSON.stringify(cases, null, 2)}
              onChange={(event) => {
                try {
                  setCases(JSON.parse(event.target.value) as BenchmarkCase[])
                  setError('')
                } catch {
                  setError('JSON ca kiểm thử chưa hợp lệ.')
                }
              }}
            />
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => void save()}
              disabled={
                busy || !datasetId || !description || cases.length === 0
              }
            >
              Lưu bất biến
            </button>
            {selected && (
              <button type="button" onClick={() => setSelected(null)}>
                Hủy
              </button>
            )}
          </div>
        </section>
      </div>

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
