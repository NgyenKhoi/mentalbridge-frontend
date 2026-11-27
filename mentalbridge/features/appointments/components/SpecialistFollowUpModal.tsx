'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardList,
  Heart,
  MessageCircle,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import type {
  FollowUpPopupKind,
  FollowUpPreviewItem,
} from '../api/follow-up-preview-contract'
import { followUpPopupPreview as preview } from '../mocks/follow-up-popup-preview'
import styles from './SpecialistFollowUpModal.module.css'

type Selection = { item: FollowUpPreviewItem; kind: FollowUpPopupKind } | null

function dateLabel(value: string | null) {
  if (!value) return 'Chưa lên lịch'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}

function IconButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-appointment-ui
      className={styles.iconButton}
      onClick={onClick}
      aria-label="Đóng popup"
    >
      <X aria-hidden="true" />
    </button>
  )
}

function Footer({ children }: { children: ReactNode }) {
  return (
    <footer className={styles.footer}>
      <span>
        <ShieldCheck aria-hidden="true" /> Bản xem trước · Không gửi hoặc lưu dữ
        liệu thật
      </span>
      <div>{children}</div>
    </footer>
  )
}

function EncourageContent({
  item,
  screening,
  onClose,
}: {
  item: FollowUpPreviewItem
  screening: boolean
  onClose: () => void
}) {
  const personalize = (value: string) => value.replaceAll('Lan', item.name)
  const [template, setTemplate] = useState(screening ? -1 : 0)
  const [message, setMessage] = useState<string>(
    screening
      ? `Chào ${item.name}, trước phiên tới bạn vui lòng hoàn thành bảng GAD-7 để chúng ta cùng xem lại kết quả nhé.`
      : personalize(preview.encouragement.templates[0].body),
  )
  const [includeScreening, setIncludeScreening] = useState(screening)
  const [remind, setRemind] = useState(true)
  const [notice, setNotice] = useState('')

  return (
    <>
      <header className={styles.headerSoft}>
        <div className={styles.titleRow}>
          <span className={styles.titleIcon}>
            <Heart aria-hidden="true" />
          </span>
          <div>
            <span className={styles.overline}>
              Theo dõi sau phiên · Dữ liệu minh họa
            </span>
            <h2 id="follow-up-popup-title">
              {screening
                ? 'Gửi bảng GAD-7 trước phiên'
                : 'Gửi tin nhắn động viên & nhắc nhở chăm sóc'}
            </h2>
            <p>
              {item.name} · {item.context} · Phiên tiếp theo{' '}
              {dateLabel(item.nextAt)}
            </p>
          </div>
          <IconButton onClick={onClose} />
        </div>
        <span className={styles.attentionTag}>
          <Bell aria-hidden="true" /> {item.badge}
        </span>
      </header>
      <div className={styles.body}>
        <div className={styles.commitment}>
          <BookOpen aria-hidden="true" />
          <div>
            <small>BƯỚC ĐÃ THỐNG NHẤT</small>
            <strong>
              {screening
                ? 'Hoàn thành bảng GAD-7 trước phiên tiếp theo'
                : preview.encouragement.commitment}
            </strong>
          </div>
          <span>{dateLabel(item.nextAt)}</span>
        </div>
        <div className={styles.sectionHeading}>
          <strong>Mẫu tin nhắn chuyên môn thấu cảm</strong>
          <small>Chọn mẫu để tự động điền</small>
        </div>
        <div className={styles.templateList}>
          {preview.encouragement.templates.map((entry, index) => (
            <button
              key={entry.title}
              type="button"
              data-appointment-ui
              className={styles.template}
              aria-pressed={template === index}
              onClick={() => {
                setTemplate(index)
                setMessage(personalize(entry.body))
                setNotice('')
              }}
            >
              <span className={styles.radio}>
                {template === index && <Check aria-hidden="true" />}
              </span>
              <span>
                <strong>
                  {index + 1}. {entry.title}
                </strong>
                <small>{personalize(entry.body)}</small>
              </span>
              <em>{entry.tag}</em>
            </button>
          ))}
        </div>
        <label className={styles.fieldLabel} htmlFor="follow-up-message">
          Nội dung gửi đến khách hàng <small>{message.length} ký tự</small>
        </label>
        <textarea
          id="follow-up-message"
          className={styles.textarea}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={4}
        />
        <div className={styles.quickRow}>
          <span>Thêm nhanh:</span>
          {preview.encouragement.quick.map((label) => (
            <button
              key={label}
              type="button"
              data-appointment-ui
              onClick={() =>
                setMessage((current) => `${current.trim()} ${label}.`)
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.attachmentList} aria-label="Bài tập đính kèm">
          <span>Đính kèm bài tập:</span>
          {preview.encouragement.attachments.map((attachment) => (
            <span key={attachment.title} className={styles.attachment}>
              <BookOpen aria-hidden="true" /> {attachment.title}{' '}
              <small>({attachment.duration})</small>
            </span>
          ))}
        </div>
        <div className={styles.options}>
          <strong>Tùy chọn hỗ trợ</strong>
          <div>
            <label>
              <input
                type="checkbox"
                checked={includeScreening}
                onChange={(event) => setIncludeScreening(event.target.checked)}
              />
              <span>
                <b>Gửi kèm bảng trắc nghiệm GAD-7</b>
                <small>Khách hàng có thể hoàn thành trước phiên tới.</small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={remind}
                onChange={(event) => setRemind(event.target.checked)}
              />
              <span>
                <b>Nhắc lại sau 24 giờ</b>
                <small>Chỉ mô phỏng trạng thái nhắc trong bản xem trước.</small>
              </span>
            </label>
          </div>
        </div>
        <p className={styles.privacyNote}>
          <ShieldCheck aria-hidden="true" /> Nội dung này chỉ là bản xem trước.
          Bạn có thể chỉnh lời nhắn trước khi gửi bằng tính năng thật.
        </p>
        {notice && (
          <p className={styles.notice} role="status">
            <CheckCircle2 aria-hidden="true" />
            {notice}
          </p>
        )}
      </div>
      <Footer>
        <button
          type="button"
          data-appointment-ui
          className={styles.secondaryButton}
          onClick={onClose}
        >
          Hủy bỏ
        </button>
        <button
          type="button"
          data-appointment-ui
          className={styles.primaryButton}
          disabled={!message.trim()}
          onClick={() =>
            setNotice(
              `Đã mô phỏng gửi tin nhắn cho ${item.name}${includeScreening ? ' kèm GAD-7' : ''}${remind ? ' và hẹn nhắc lại sau 24 giờ' : ''}.`,
            )
          }
        >
          <Send aria-hidden="true" />{' '}
          {screening ? 'Gửi bảng GAD-7' : 'Gửi tin nhắn động viên ngay'}
        </button>
      </Footer>
    </>
  )
}

function MetricStrip({ item }: { item: FollowUpPreviewItem }) {
  const completion = item.progress
    ? Math.round((item.progress.completed / item.progress.total) * 100)
    : 33
  const frequency = item.progress
    ? item.progress.completed + '/' + item.progress.total
    : preview.summary.journalFrequency
  return (
    <div className={styles.metricStrip}>
      <div>
        <span className={styles.metricIcon}>
          <ClipboardList aria-hidden="true" />
        </span>
        <small>THANG ĐO GAD-7</small>
        <strong>
          {item.id === 'hoang-lan' ? preview.summary.gadScore : '—'}
        </strong>
        <span>
          {item.id === 'hoang-lan'
            ? 'Lo âu vừa · Minh họa'
            : 'Chưa có điểm mẫu'}
        </span>
      </div>
      <div>
        <span className={styles.metricIcon}>
          <BookOpen aria-hidden="true" />
        </span>
        <small>TẦN SUẤT GHI NHẬN</small>
        <strong>{frequency}</strong>
        <span>Hoạt động giữa các phiên</span>
      </div>
      <div>
        <span className={styles.metricIcon}>
          <CheckCircle2 aria-hidden="true" />
        </span>
        <small>MỨC ĐỘ HOÀN THÀNH</small>
        <strong>
          {item.id === 'hoang-lan'
            ? preview.summary.adherence
            : completion + '%'}
        </strong>
        <span className={styles.miniTrack}>
          <i
            style={{
              width:
                item.id === 'hoang-lan'
                  ? preview.summary.adherence
                  : completion + '%',
            }}
          />
        </span>
      </div>
    </div>
  )
}

function SessionHeader({
  item,
  title,
  onClose,
}: {
  item: FollowUpPreviewItem
  title: string
  onClose: () => void
}) {
  return (
    <>
      <div className={styles.greenBand}>
        <ShieldCheck aria-hidden="true" /> BẢN XEM TRƯỚC · DỮ LIỆU MINH HỌA{' '}
        <span>Phiên tiếp theo: {dateLabel(item.nextAt)}</span>
      </div>
      <header className={styles.sessionHeader}>
        <div>
          <span className={styles.overline}>Theo dõi sau phiên</span>
          <h2 id="follow-up-popup-title">{title}</h2>
          <p>
            <span className={styles.inlineAvatar}>{item.initials}</span>
            <strong>{item.name}</strong>
            <span>·</span>
            {item.context}
          </p>
        </div>
        <IconButton onClick={onClose} />
      </header>
      <MetricStrip item={item} />
    </>
  )
}

function SummaryContent({
  item,
  onClose,
  onSelect,
}: {
  item: FollowUpPreviewItem
  onClose: () => void
  onSelect: (kind: FollowUpPopupKind) => void
}) {
  return (
    <>
      <SessionHeader
        item={item}
        title={'Bản tóm tắt phiên ' + preview.summary.sessionDate}
        onClose={onClose}
      />
      <div className={styles.body}>
        <div className={styles.summaryMeta}>
          <span>{preview.summary.recordId} · Phiên 04 / 12</span>
          <span>50 phút · Trực tuyến</span>
        </div>
        <div className={styles.sectionHeading}>
          <strong>Cấu trúc ghi chú phiên</strong>
          <small>Chủ quan · Khách quan · Đánh giá · Kế hoạch</small>
        </div>
        <div className={styles.soapGrid}>
          {Object.entries({
            S: ['Chủ quan', preview.summary.subjective],
            O: ['Khách quan', preview.summary.objective],
            A: ['Đánh giá', preview.summary.assessment],
            P: ['Kế hoạch', preview.summary.plan],
          }).map(([letter, [heading, body]]) => (
            <section key={letter} className={styles.soapCard}>
              <h3>
                <span>{letter}</span>
                {heading}
              </h3>
              <p>{body}</p>
              {letter === 'S' && (
                <blockquote className={styles.soapQuote}>
                  “{preview.summary.quote}”
                </blockquote>
              )}
            </section>
          ))}
        </div>
      </div>
      <Footer>
        <button
          type="button"
          data-appointment-ui
          className={styles.secondaryButton}
          onClick={() => onSelect('chat')}
        >
          <MessageCircle aria-hidden="true" /> Mở phòng chat trao đổi
        </button>
        <button
          type="button"
          data-appointment-ui
          className={styles.secondaryButton}
          onClick={() => onSelect('progress')}
        >
          <ClipboardList aria-hidden="true" /> Điều chỉnh kế hoạch
        </button>
        <button
          type="button"
          data-appointment-ui
          className={styles.primaryButton}
          onClick={onClose}
        >
          Đóng / Hoàn tất
        </button>
      </Footer>
    </>
  )
}

function ProgressContent({
  item,
  onClose,
  onSelect,
}: {
  item: FollowUpPreviewItem
  onClose: () => void
  onSelect: (kind: FollowUpPopupKind) => void
}) {
  const [checked, setChecked] = useState<number[]>([0])
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState('')
  return (
    <>
      <SessionHeader
        item={item}
        title="Cập nhật tiến trình & điều chỉnh bài tập"
        onClose={onClose}
      />
      <div className={styles.body}>
        <div className={styles.sectionHeading}>
          <strong>Hoạt động giữa các phiên</strong>
          <small>
            {checked.length}/{preview.exercises.length} hoạt động đã ghi nhận
          </small>
        </div>
        <div className={styles.exerciseList}>
          {preview.exercises.map((exercise, index) => (
            <label key={exercise.title} className={styles.exercise}>
              <input
                type="checkbox"
                checked={checked.includes(index)}
                onChange={() =>
                  setChecked((current) =>
                    current.includes(index)
                      ? current.filter((value) => value !== index)
                      : [...current, index],
                  )
                }
              />
              <span>
                <strong>
                  <mark>Bài tập {String(index + 1).padStart(2, '0')}</mark>{' '}
                  {exercise.title}
                </strong>
                <small>{exercise.detail}</small>
              </span>
              <em>
                {checked.includes(index) ? 'Đã ghi nhận' : exercise.status}
              </em>
            </label>
          ))}
        </div>
        <div className={styles.notePanel}>
          <label className={styles.fieldLabel} htmlFor="follow-up-note">
            Ghi chú giữa các phiên <small>{note.length}/300 ký tự</small>
          </label>
          <textarea
            id="follow-up-note"
            className={styles.textarea}
            maxLength={300}
            rows={3}
            placeholder="Nhập lưu ý về tiến trình để xem trước giao diện…"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className={styles.noteActions}>
            <span>Bản nháp chỉ hiển thị trong bản xem trước.</span>
            <button
              type="button"
              data-appointment-ui
              className={styles.secondaryButton}
              onClick={() => setNotice('Đã lưu ghi chú trong bản xem trước.')}
            >
              <Check aria-hidden="true" /> Lưu ghi chú
            </button>
          </div>
        </div>
        {notice && (
          <p className={styles.notice} role="status">
            <CheckCircle2 aria-hidden="true" />
            {notice}
          </p>
        )}
      </div>
      <Footer>
        <button
          type="button"
          data-appointment-ui
          className={styles.secondaryButton}
          onClick={() => onSelect('chat')}
        >
          <MessageCircle aria-hidden="true" /> Mở phòng chat trao đổi
        </button>
        <button
          type="button"
          data-appointment-ui
          className={styles.secondaryButton}
          onClick={() => onSelect('summary')}
        >
          <BookOpen aria-hidden="true" /> Xem tóm tắt
        </button>
        <button
          type="button"
          data-appointment-ui
          className={styles.primaryButton}
          onClick={onClose}
        >
          Đóng / Hoàn tất
        </button>
      </Footer>
    </>
  )
}

function PrepareContent({
  item,
  questionsOnly,
  onClose,
  onSelect,
}: {
  item: FollowUpPreviewItem
  questionsOnly: boolean
  onClose: () => void
  onSelect: (kind: FollowUpPopupKind) => void
}) {
  const [note, setNote] = useState<string>(preview.session.note)
  const [notice, setNotice] = useState('')
  return (
    <>
      <header className={styles.sessionHeader}>
        <div>
          <span className={styles.overline}>
            Sẵn sàng cho phiên mới · Bản xem trước
          </span>
          <h2 id="follow-up-popup-title">
            {questionsOnly
              ? 'Câu hỏi khách hàng gửi trước phiên'
              : 'Chuẩn bị phiên tham vấn tiếp theo'}
          </h2>
          <p>
            <span className={styles.inlineAvatar}>{item.initials}</span>
            <strong>{item.name}</strong>
            <span>·</span>
            {dateLabel(item.nextAt)}
            <span>·</span>
            {item.context}
          </p>
        </div>
        <IconButton onClick={onClose} />
      </header>
      <div className={styles.readyBanner}>
        <CheckCircle2 aria-hidden="true" />
        <span>
          <strong>Thông tin chuẩn bị đã sẵn sàng</strong>
          <small>
            Câu hỏi, bài tập và ghi nhận của khách hàng được đặt cạnh nhau để
            xem trước phiên.
          </small>
        </span>
        <b>{preview.session.updatedAt}</b>
      </div>
      <div className={styles.body}>
        <div className={styles.prepareGrid}>
          <div className={styles.prepareColumn}>
            <section className={styles.prepCard}>
              <div className={styles.prepCardHeading}>
                <h3>{preview.session.assessmentName}</h3>
                <small>TỰ LƯỢNG GIÁ</small>
              </div>
              <strong className={styles.largeScore}>
                {preview.session.score}
              </strong>
              <p>
                {preview.session.improvement} · Lần trước{' '}
                {preview.session.previousScore}
              </p>
              <div className={styles.miniTrack}>
                <i style={{ width: preview.session.completion }} />
              </div>
              <small>Hoàn thành hoạt động: {preview.session.completion}</small>
            </section>
            <section className={styles.prepCard}>
              <div className={styles.prepCardHeading}>
                <h3>Nhật ký cảm xúc tổng kết</h3>
                <small>Khách hàng tự ghi nhận</small>
              </div>
              <blockquote>“{preview.session.journal}”</blockquote>
            </section>
          </div>
          <div className={styles.prepareColumn}>
            <section className={styles.prepCard}>
              <div className={styles.prepCardHeading}>
                <h3>
                  Câu hỏi & kỳ vọng trước phiên{' '}
                  <span>{preview.session.questions.length}</span>
                </h3>
                <small>Gửi trước buổi hẹn</small>
              </div>
              {preview.session.questions.map((question, index) => (
                <div key={question} className={styles.question}>
                  <small>CÂU HỎI {String(index + 1).padStart(2, '0')}</small>
                  <p>“{question}”</p>
                  <span>Gợi ý thảo luận trong phiên</span>
                </div>
              ))}
            </section>
            <section className={styles.prepCard}>
              <label
                className={styles.fieldLabel}
                htmlFor="follow-up-prep-note"
              >
                Ghi chú định hướng phiên <small>{note.length} ký tự</small>
              </label>
              <textarea
                id="follow-up-prep-note"
                className={styles.textarea}
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <button
                type="button"
                data-appointment-ui
                className={styles.secondaryButton}
                onClick={() => setNotice('Đã lưu ghi chú trong bản xem trước.')}
              >
                <Check aria-hidden="true" /> Lưu ghi chú
              </button>
            </section>
          </div>
        </div>
        {notice && (
          <p className={styles.notice} role="status">
            <CheckCircle2 aria-hidden="true" />
            {notice}
          </p>
        )}
      </div>
      <Footer>
        <button
          type="button"
          data-appointment-ui
          className={styles.secondaryButton}
          onClick={onClose}
        >
          Đóng
        </button>
        <button
          type="button"
          data-appointment-ui
          className={styles.secondaryButton}
          onClick={() => onSelect('chat')}
        >
          <MessageCircle aria-hidden="true" /> Nhắn tin xác nhận
        </button>
        <Link href="/specialist/appointments" className={styles.primaryButton}>
          <ArrowRight aria-hidden="true" /> Vào phòng tham vấn (Sẵn sàng)
        </Link>
      </Footer>
    </>
  )
}

export default function SpecialistFollowUpModal({
  selection,
  onClose,
  onSelect,
}: {
  selection: Selection
  onClose: () => void
  onSelect: (item: FollowUpPreviewItem, kind: FollowUpPopupKind) => void
}) {
  const item = selection?.item
  const kind = selection?.kind
  return (
    <Dialog
      open={selection !== null}
      onOpenChange={(open) => !open && onClose()}
      labelledBy="follow-up-popup-title"
      className={`${styles.dialog} ${kind === 'encourage' || kind === 'screening' ? styles.narrowDialog : ''}`}
    >
      {item && kind && (
        <div key={`${item.id}-${kind}`} className={styles.shell}>
          {(kind === 'encourage' || kind === 'screening') && (
            <EncourageContent
              item={item}
              screening={kind === 'screening'}
              onClose={onClose}
            />
          )}
          {kind === 'summary' && (
            <SummaryContent
              item={item}
              onClose={onClose}
              onSelect={(next) => onSelect(item, next)}
            />
          )}
          {kind === 'progress' && (
            <ProgressContent
              item={item}
              onClose={onClose}
              onSelect={(next) => onSelect(item, next)}
            />
          )}
          {(kind === 'prepare' || kind === 'questions') && (
            <PrepareContent
              item={item}
              questionsOnly={kind === 'questions'}
              onClose={onClose}
              onSelect={(next) => onSelect(item, next)}
            />
          )}
        </div>
      )}
    </Dialog>
  )
}
