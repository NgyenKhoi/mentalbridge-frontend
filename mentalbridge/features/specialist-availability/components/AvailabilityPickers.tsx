'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from 'lucide-react'
import { addDays, dateKey, formatDate } from './availability-time'
import styles from './SpecialistAvailabilityManager.module.css'

function usePicker() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const close = (restore = false) => {
    setOpen(false)
    if (restore) triggerRef.current?.focus()
  }
  useEffect(() => {
    if (!open) return
    panelRef.current
      ?.querySelector<HTMLButtonElement>('[data-initial-focus]')
      ?.focus()
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      )
        setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  return { open, setOpen, rootRef, triggerRef, panelRef, close }
}

type DatePickerProps = Readonly<{
  value: string
  min: string
  disabled: boolean
  onChange: (value: string) => void
}>

export function AvailabilityDatePicker({
  value,
  min,
  disabled,
  onChange,
}: DatePickerProps) {
  const {
    open,
    setOpen,
    rootRef,
    triggerRef,
    panelRef,
    close: closePicker,
  } = usePicker()
  const id = useId()
  const [cursor, setCursor] = useState(min)
  const anchor = new Date(`${cursor || min}T12:00:00Z`)
  const month = anchor.getUTCMonth()
  const year = anchor.getUTCFullYear()
  const first = new Date(Date.UTC(year, month, 1, 12))
  const start = addDays(dateKey(first), -((first.getUTCDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index))
  const currentYear = Number(min.slice(0, 4))
  const years = [
    ...new Set([
      ...Array.from({ length: 11 }, (_, index) => currentYear + index),
      year,
    ]),
  ].sort((a, b) => a - b)
  const choose = (date: string) => {
    onChange(date)
    closePicker(true)
  }
  const navigate = (offset: number) => {
    const candidate = dateKey(new Date(Date.UTC(year, month + offset, 1, 12)))
    setCursor(candidate < min ? min : candidate)
  }
  const changeMonth = (nextYear: number, nextMonth: number) => {
    const candidate = dateKey(new Date(Date.UTC(nextYear, nextMonth, 1, 12)))
    setCursor(candidate < min ? min : candidate)
  }
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    let next: string | undefined
    if (event.key in offsets) next = addDays(date, offsets[event.key])
    else if (event.key === 'Home')
      next = addDays(
        date,
        -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7),
      )
    else if (event.key === 'End')
      next = addDays(
        date,
        6 - ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7),
      )
    if (!next) return
    event.preventDefault()
    if (next < min) next = min
    setCursor(next)
  }
  useEffect(() => {
    if (open)
      panelRef.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${cursor}"]`)
        ?.focus()
  }, [cursor, open, panelRef])

  return (
    <div
      ref={rootRef}
      className={styles.picker}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          closePicker()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          closePicker(true)
        }
      }}
    >
      <label htmlFor={`${id}-date`}>Ngày</label>
      <div className={styles.inputShell}>
        <span aria-hidden="true" className={styles.formattedValue}>
          {value
            ? formatDate(value, {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })
            : 'dd / mm / yyyy'}
        </span>
        <input
          id={`${id}-date`}
          type="date"
          min={min}
          required
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          ref={triggerRef}
          type="button"
          className={styles.pickerTrigger}
          aria-label="Mở lịch chọn ngày"
          aria-expanded={open}
          aria-controls={`${id}-calendar`}
          disabled={disabled}
          onClick={() => {
            if (!open) setCursor(value && value >= min ? value : min)
            setOpen(!open)
          }}
        >
          <CalendarDays size={18} />
        </button>
      </div>
      {open && (
        <div
          ref={panelRef}
          id={`${id}-calendar`}
          role="dialog"
          aria-label="Chọn ngày tư vấn"
          className={styles.popover}
        >
          <div className={styles.pickerHeading}>
            <strong>Chọn ngày tư vấn</strong>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Đóng lịch chọn ngày"
              onClick={() => closePicker(true)}
            >
              <X size={17} />
            </button>
          </div>
          <div className={styles.monthNavigation}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Tháng trước"
              disabled={
                `${year}-${String(month + 1).padStart(2, '0')}` <=
                min.slice(0, 7)
              }
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <select
              aria-label="Tháng"
              value={month}
              onChange={(event) =>
                changeMonth(year, Number(event.target.value))
              }
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index} value={index}>
                  Tháng {index + 1}
                </option>
              ))}
            </select>
            <select
              aria-label="Năm"
              value={year}
              onChange={(event) =>
                changeMonth(Number(event.target.value), month)
              }
            >
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Tháng sau"
              onClick={() => navigate(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div
            className={styles.calendar}
            role="grid"
            aria-label={`Tháng ${month + 1} năm ${year}`}
          >
            <div className={styles.calendarRow} role="row">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
                <span key={day} role="columnheader">
                  {day}
                </span>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, row) => (
              <div key={row} className={styles.calendarRow} role="row">
                {days.slice(row * 7, row * 7 + 7).map((date) => (
                  <div
                    key={date}
                    role="gridcell"
                    aria-selected={date === value}
                  >
                    <button
                      type="button"
                      data-date={date}
                      data-initial-focus={date === cursor ? '' : undefined}
                      data-selected={date === value}
                      data-other-month={
                        date.slice(0, 7) !== dateKey(first).slice(0, 7)
                      }
                      aria-label={formatDate(date, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                      aria-current={date === min ? 'date' : undefined}
                      tabIndex={date === cursor ? 0 : -1}
                      disabled={date < min}
                      onKeyDown={(event) => moveFocus(event, date)}
                      onClick={() => choose(date)}
                    >
                      {Number(date.slice(-2))}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className={styles.pickerFooter}>
            <span>Chỉ chọn ngày từ hôm nay</span>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => choose(min)}
            >
              Hôm nay
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

type TimePickerProps = Readonly<{
  value: string
  disabled: boolean
  onChange: (value: string) => void
}>

export function AvailabilityTimePicker({
  value,
  disabled,
  onChange,
}: TimePickerProps) {
  const {
    open,
    setOpen,
    rootRef,
    triggerRef,
    panelRef,
    close: closePicker,
  } = usePicker()
  const id = useId()
  const [draft, setDraft] = useState('09:00')
  const [hour, minute] = draft.split(':')
  return (
    <div
      ref={rootRef}
      className={styles.picker}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          closePicker()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation()
          closePicker(true)
        }
      }}
    >
      <label htmlFor={`${id}-time`}>Giờ bắt đầu</label>
      <div className={styles.inputShell}>
        <span aria-hidden="true" className={styles.formattedValue}>
          {value || 'hh : mm'}
        </span>
        <input
          id={`${id}-time`}
          type="time"
          required
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          ref={triggerRef}
          type="button"
          className={styles.pickerTrigger}
          aria-label="Mở bộ chọn giờ"
          aria-expanded={open}
          aria-controls={`${id}-time-picker`}
          disabled={disabled}
          onClick={() => {
            setDraft(value || '09:00')
            setOpen(!open)
          }}
        >
          <Clock3 size={18} />
        </button>
      </div>
      {open && (
        <div
          ref={panelRef}
          id={`${id}-time-picker`}
          role="dialog"
          aria-label="Chọn giờ bắt đầu"
          className={styles.popover}
        >
          <div className={styles.pickerHeading}>
            <strong>Chọn giờ bắt đầu</strong>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Đóng bộ chọn giờ"
              onClick={() => closePicker(true)}
            >
              <X size={17} />
            </button>
          </div>
          <p className={styles.timeReadout}>
            {draft}
            <span>Khung tư vấn 60 phút</span>
          </p>
          <div className={styles.timeColumns}>
            <div>
              <span>Giờ</span>
              <div className={styles.hours}>
                {Array.from({ length: 24 }, (_, index) =>
                  String(index).padStart(2, '0'),
                ).map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-label={`${item} giờ`}
                    aria-pressed={hour === item}
                    data-initial-focus={hour === item ? '' : undefined}
                    onClick={() => setDraft(`${item}:${minute}`)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor={`${id}-minute`}>Phút</label>
              <input
                id={`${id}-minute`}
                type="number"
                min="0"
                max="59"
                value={Number(minute)}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (Number.isInteger(next) && next >= 0 && next <= 59)
                    setDraft(`${hour}:${String(next).padStart(2, '0')}`)
                }}
              />
              <div className={styles.minutes}>
                {['00', '15', '30', '45'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-label={`${item} phút`}
                    aria-pressed={minute === item}
                    onClick={() => setDraft(`${hour}:${item}`)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            className={`btn-primary ${styles.pickerApply}`}
            onClick={() => {
              onChange(draft)
              closePicker(true)
            }}
          >
            <Check size={16} />
            Chọn {draft}
          </button>
        </div>
      )}
    </div>
  )
}
