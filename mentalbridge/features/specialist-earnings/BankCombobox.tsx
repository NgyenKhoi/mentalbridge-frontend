'use client'

import { Check } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import type { KeyboardEvent, Ref } from 'react'
import styles from './BankCombobox.module.css'

export type BankOption = Readonly<{
  bin: string
  name: string
  shortName: string
}>

type BankComboboxProps = Readonly<{
  banks: readonly BankOption[] | null
  loading: boolean
  loadFailed: boolean
  onRetry: () => void
  value: string
  onChange: (bin: string) => void
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
  inputRef?: Ref<HTMLInputElement>
}>

// Vietnamese search ignores accents: "dong a" finds "Đông Á".
function fold(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
}

export function BankCombobox({
  banks,
  loading,
  loadFailed,
  onRetry,
  value,
  onChange,
  invalid,
  describedBy,
  disabled,
  inputRef,
}: BankComboboxProps) {
  const id = useId()
  const listId = `${id}-list`
  const selected = banks?.find((bank) => bank.bin === value)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const text = editing ? query : (selected?.shortName ?? '')
  const matches = useMemo(() => {
    const needle = fold(editing ? query.trim() : '')
    if (!banks) return []
    if (!needle) return banks
    return banks.filter((bank) =>
      fold(`${bank.shortName} ${bank.name} ${bank.bin}`).includes(needle),
    )
  }, [banks, editing, query])
  const unavailable = loading || loadFailed || !banks || Boolean(disabled)

  function choose(bank: BankOption) {
    onChange(bank.bin)
    setEditing(false)
    setOpen(false)
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((index) => {
        const next = Math.min(Math.max(index + step, 0), matches.length - 1)
        document
          .getElementById(`${id}-opt-${next}`)
          ?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (event.key === 'Enter' && open && matches[active]) {
      event.preventDefault()
      choose(matches[active])
    } else if (event.key === 'Escape' && open) {
      // Close the list only; the dialog stays open.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      setEditing(false)
    }
  }

  return (
    <div className={styles.root}>
      <label htmlFor={`${id}-input`} className={styles.label}>
        Ngân hàng
      </label>
      <input
        id={`${id}-input`}
        ref={inputRef}
        className={styles.input}
        role="combobox"
        aria-expanded={open && !unavailable}
        aria-controls={open && !unavailable ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          open && matches[active] ? `${id}-opt-${active}` : undefined
        }
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-disabled={unavailable}
        readOnly={unavailable}
        disabled={disabled}
        autoComplete="off"
        placeholder={
          loading
            ? 'Đang tải danh sách ngân hàng…'
            : 'Tìm tên hoặc mã ngân hàng'
        }
        value={text}
        onChange={(event) => {
          setQuery(event.target.value)
          setEditing(true)
          setOpen(true)
          setActive(0)
          if (value) onChange('')
        }}
        onFocus={() => !unavailable && setOpen(true)}
        onClick={() => !unavailable && setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setEditing(false)
        }}
        onKeyDown={onKeyDown}
      />
      {loadFailed && (
        <p className={styles.note} role="alert">
          Chưa tải được danh sách ngân hàng.{' '}
          <button type="button" className={styles.retry} onClick={onRetry}>
            Thử lại
          </button>
        </p>
      )}
      <ul
        id={listId}
        role="listbox"
        aria-label="Danh sách ngân hàng"
        className={styles.list}
        hidden={!open || unavailable}
      >
        {matches.map((bank, index) => (
          <li
            key={bank.bin}
            id={`${id}-opt-${index}`}
            role="option"
            aria-selected={bank.bin === value}
            data-active={index === active}
            className={styles.option}
            // Keep focus in the input so blur does not close the list before the click lands.
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActive(index)}
            onClick={() => choose(bank)}
          >
            <span>
              <strong>{bank.shortName}</strong>
              <em>{bank.name}</em>
            </span>
            {bank.bin === value && <Check size={16} aria-hidden="true" />}
          </li>
        ))}
        {matches.length === 0 && (
          <li role="presentation" className={styles.empty}>
            Không tìm thấy ngân hàng phù hợp.
          </li>
        )}
      </ul>
    </div>
  )
}
