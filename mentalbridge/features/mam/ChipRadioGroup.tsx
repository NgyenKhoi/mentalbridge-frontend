'use client'

import { useRef, type KeyboardEvent } from 'react'

import styles from './MamChoice.module.css'

/**
 * Single choice as pill chips with radio-group semantics: one tab stop (the chosen chip, else the first),
 * arrow keys move and choose, as a native radio group does.
 */
export function ChipRadioGroup<T extends string | number>({
  labelledBy,
  options,
  value,
  onChange,
  disabled = false,
}: Readonly<{
  labelledBy: string
  options: ReadonlyArray<Readonly<{ value: T; label: string }>>
  value: T | null
  onChange: (value: T) => void
  disabled?: boolean
}>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const stop = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      className={styles.chips}
      role="radiogroup"
      aria-labelledby={labelledBy}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => {
            refs.current[index] = node
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={index === stop ? 0 : -1}
          disabled={disabled}
          className={styles.chip}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
