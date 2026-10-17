'use client'

import { useMemo } from 'react'
import type { ResourceBingoBoard } from '../api/browser-resource-engagement'
import styles from './resources-showcase.module.css'

type Props = Readonly<{
  board: ResourceBingoBoard | null
  state: 'idle' | 'loading' | 'ready' | 'missing' | 'error' | 'stale'
  pendingPosition: number | null
  onToggle: (position: number, selfConfirmed: boolean) => void
  onRetry: () => void
}>

const BINGO_LINES: readonly (readonly number[])[] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [1, 4, 7],
  [2, 5, 8],
  [3, 6, 9],
  [1, 5, 9],
  [3, 5, 7],
]

function formatWeekRange(weekStart: string): string {
  try {
    const monday = new Date(`${weekStart}T00:00:00Z`)
    const sunday = new Date(monday)
    sunday.setUTCDate(sunday.getUTCDate() + 6)
    const d1 = monday.getUTCDate()
    const m1 = monday.getUTCMonth() + 1
    const d2 = sunday.getUTCDate()
    const m2 = sunday.getUTCMonth() + 1
    return `Tuần ${d1}/${m1} – ${d2}/${m2}`
  } catch {
    return `Tuần ${weekStart}`
  }
}

function evidenceCopy(item: ResourceBingoBoard['items'][number]) {
  if (item.evidence === 'CONTENT_VERIFIED') {
    return item.verificationSource === 'PRACTICE_SESSION'
      ? 'Đã xác minh từ buổi thực hành'
      : 'Đã xác minh từ bài tập hoàn thành'
  }
  if (item.evidence === 'SELF_CONFIRMED') return 'Bạn tự đánh dấu'
  return 'Chưa đánh dấu'
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function CircleIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export function ResourceBingoPanel({
  board,
  state,
  pendingPosition,
  onToggle,
  onRetry,
}: Props) {
  const markedCount = useMemo(() => {
    if (!board?.items) return 0
    return board.items.filter((item) => item.evidence !== 'NONE').length
  }, [board])

  const completedLines = useMemo(() => {
    if (!board?.items) return 0
    const marked = new Set(
      board.items
        .filter((item) => item.evidence !== 'NONE')
        .map((item) => item.position),
    )
    return BINGO_LINES.filter((line) => line.every((pos) => marked.has(pos)))
      .length
  }, [board])

  return (
    <section className={styles.bingo} aria-labelledby="bingo-title">
      <div className={styles.panelHead}>
        <div>
          <h2 id="bingo-title">Bingo hoạt động trong kế hoạch</h2>
          <p>
            Đánh dấu khi bạn hoàn thành hoạt động để tạo chuỗi thói quen lành mạnh.
          </p>
        </div>
        {board && state === 'ready' && (
          <div className={styles.bingoHeadBadges}>
            <span className={styles.bingoWeekBadge}>
              {formatWeekRange(board.weekStart)}
            </span>
            <span className={styles.bingoCountBadge}>{markedCount}/9 ô</span>
          </div>
        )}
      </div>

      {board && state === 'ready' ? (
        board.items.length ? (
          <>
            <div className={styles.bingoGrid} role="list">
              {board.items.map((item) => {
                const verified = item.evidence === 'CONTENT_VERIFIED'
                const selfConfirmed = item.selfConfirmedAt !== null
                const canToggle = !verified || selfConfirmed
                const isPending = pendingPosition === item.position

                return (
                  <div
                    role="listitem"
                    key={`${item.position}:${item.resourceId}:${item.contentVersion}`}
                    className={`${styles.bingoTile} ${
                      verified
                        ? styles.bingoVerified
                        : selfConfirmed
                          ? styles.bingoSelfConfirmed
                          : styles.bingoUnmarked
                    }`}
                    title={`Ô #${item.position}: ${item.label} (${evidenceCopy(item)})`}
                  >
                    <div className={styles.bingoTileTop}>
                      <span className={styles.bingoTileNumber}>
                        #{item.position}
                      </span>
                      <span className={styles.bingoTileIcon}>
                        {verified || selfConfirmed ? (
                          <CheckIcon />
                        ) : (
                          <CircleIcon />
                        )}
                      </span>
                    </div>

                    <strong className={styles.bingoTileTitle}>
                      {item.label}
                    </strong>

                    {selfConfirmed && (
                      <small className={styles.bingoEvidenceText}>
                        {evidenceCopy(item)}
                      </small>
                    )}

                    <div className={styles.bingoTileBottom}>
                      {isPending ? (
                        <span className={styles.bingoPillPending}>
                          Đang lưu…
                        </span>
                      ) : verified && !selfConfirmed ? (
                        <span className={styles.bingoPillVerified}>
                          ✓ Đã xác minh
                        </span>
                      ) : canToggle ? (
                        <button
                          type="button"
                          className={
                            selfConfirmed
                              ? styles.bingoPillSelf
                              : styles.bingoPillAction
                          }
                          disabled={pendingPosition !== null}
                          aria-pressed={selfConfirmed}
                          onClick={() => onToggle(item.position, !selfConfirmed)}
                        >
                          {selfConfirmed ? 'Bỏ tự đánh dấu' : 'Tự đánh dấu'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>

            {completedLines > 0 ? (
              <p
                className={`${styles.bingoNote} ${styles.bingoNoteComplete}`}
                role="status"
              >
                <span aria-hidden="true">🎉</span>
                <span>
                  Tuyệt vời! Bạn đã hoàn thành {completedLines} hàng Bingo tuần này và duy trì nhịp chăm sóc tâm trí đều đặn.
                </span>
              </p>
            ) : (
              <p className={styles.bingoNote} role="status">
                <span aria-hidden="true">💡</span>
                <span>
                  Chạm vào ô để đánh dấu khi bạn thực hiện hoạt động. Hoàn thành 3 ô thẳng hàng (ngang, dọc, chéo) để mở dấu ấn tuần.
                </span>
              </p>
            )}
          </>
        ) : (
          <p className={styles.panelEmpty} role="status">
            Kế hoạch tuần này chưa có ô Bingo. Bạn có thể bỏ qua mà không bị trừ tiến độ.
          </p>
        )
      ) : (
        <div className={styles.bingoState} role="status">
          <p>
            {state === 'loading'
              ? 'Đang tải Bingo đã lưu…'
              : state === 'missing'
                ? 'Tuần này chưa có bảng Bingo.'
                : state === 'stale'
                  ? 'Thay đổi Bingo chưa được đối soát. Các dấu cũ đang được ẩn để tránh nhầm là trạng thái hiện tại.'
                  : state === 'error'
                    ? 'Chưa tải được Bingo đã lưu. Không có ô nào được suy đoán.'
                    : 'Bingo sẽ xuất hiện khi hành trình hôm nay tải xong.'}
          </p>
          {(state === 'error' || state === 'stale' || state === 'missing') && (
            <button type="button" onClick={onRetry}>
              {state === 'missing'
                ? 'Kiểm tra lại bảng Bingo'
                : 'Tải trạng thái mới nhất'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
