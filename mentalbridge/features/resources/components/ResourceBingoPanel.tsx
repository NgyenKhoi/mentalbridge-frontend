'use client'

import type { ResourceBingoBoard } from '../api/browser-resource-engagement'
import styles from './resources-showcase.module.css'

type Props = Readonly<{
  board: ResourceBingoBoard | null
  state: 'idle' | 'loading' | 'ready' | 'missing' | 'error' | 'stale'
  pendingPosition: number | null
  onToggle: (position: number, selfConfirmed: boolean) => void
  onRetry: () => void
}>

function evidenceCopy(item: ResourceBingoBoard['items'][number]) {
  if (item.evidence === 'CONTENT_VERIFIED') {
    return item.verificationSource === 'PRACTICE_SESSION'
      ? 'Đã xác minh từ buổi thực hành đã lưu'
      : 'Đã xác minh từ hoạt động đã hoàn thành'
  }
  if (item.evidence === 'SELF_CONFIRMED') return 'Bạn tự đánh dấu'
  return 'Chưa đánh dấu'
}

export function ResourceBingoPanel({
  board,
  state,
  pendingPosition,
  onToggle,
  onRetry,
}: Props) {
  return (
    <section className={styles.bingo} aria-labelledby="bingo-title">
      <div className={styles.panelHead}>
        <div>
          <h2 id="bingo-title">Bingo hoạt động trong kế hoạch</h2>
          <p>Dấu tự chọn và dấu được hệ thống xác minh luôn hiển thị riêng.</p>
        </div>
        {board && state === 'ready' && <span>Tuần {board.weekStart}</span>}
      </div>

      {board && state === 'ready' ? (
        board.items.length ? (
          <div className={styles.bingoGrid} role="list">
            {board.items.map((item) => {
              const verified = item.evidence === 'CONTENT_VERIFIED'
              const selfConfirmed = item.selfConfirmedAt !== null
              const canToggle = !verified || selfConfirmed
              return (
                <div
                  role="listitem"
                  key={`${item.position}:${item.resourceId}:${item.contentVersion}`}
                  className={
                    verified
                      ? styles.bingoVerified
                      : selfConfirmed
                        ? styles.bingoSelfConfirmed
                        : ''
                  }
                  aria-label={`${item.label}, ${evidenceCopy(item)}, phiên bản ${item.contentVersion}`}
                >
                  <span aria-hidden="true">
                    {verified ? '✓' : selfConfirmed ? '●' : '○'}
                  </span>
                  <strong>{item.label}</strong>
                  <small>{evidenceCopy(item)}</small>
                  <small>Phiên bản {item.contentVersion}</small>
                  {canToggle && (
                    <button
                      type="button"
                      disabled={pendingPosition !== null}
                      aria-pressed={selfConfirmed}
                      onClick={() => onToggle(item.position, !selfConfirmed)}
                    >
                      {pendingPosition === item.position
                        ? 'Đang lưu…'
                        : selfConfirmed
                          ? 'Bỏ tự đánh dấu'
                          : 'Tự đánh dấu'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className={styles.panelEmpty} role="status">
            Kế hoạch tuần này chưa có ô Bingo. Bạn có thể bỏ qua mà không bị trừ
            tiến độ.
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
          {(state === 'error' || state === 'stale') && (
            <button type="button" onClick={onRetry}>
              Tải trạng thái mới nhất
            </button>
          )}
        </div>
      )}

      <p className={styles.bingoNote}>
        Bạn có thể tự đánh dấu hoặc bỏ dấu. Dấu xác minh chỉ xuất hiện từ dữ
        liệu Content đã lưu; bỏ qua một ô không gây phạt.
      </p>
    </section>
  )
}
