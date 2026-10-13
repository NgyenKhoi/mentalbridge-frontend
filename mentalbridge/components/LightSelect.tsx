'use client'

import { useEffect, useRef, useState } from 'react'
import './LightSelect.css'

export type LightSelectOption = { value: string; label: string }

type LightSelectProps = {
  id: string
  name?: string
  value?: string
  defaultValue?: string
  placeholder?: string
  options: LightSelectOption[]
  onChange?: (value: string) => void
  className?: string
  disabled?: boolean
  labelledBy?: string
}

export default function LightSelect({
  id,
  name,
  value,
  defaultValue = '',
  placeholder = 'Chọn một mục',
  options,
  onChange,
  className = '',
  disabled = false,
  labelledBy,
}: LightSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const openingIndex = useRef(0)
  const search = useRef({ value: '', at: 0 })
  const [open, setOpen] = useState(false)
  const [previousDisabled, setPreviousDisabled] = useState(disabled)
  const [opensUp, setOpensUp] = useState(false)
  const [menuHeight, setMenuHeight] = useState(240)
  const [internalValue, setInternalValue] = useState(defaultValue)
  const selectedValue = value ?? internalValue
  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  )

  if (previousDisabled !== disabled) {
    setPreviousDisabled(disabled)
    setOpen(false)
  }

  useEffect(() => {
    if (!open || disabled) return
    optionRefs.current[openingIndex.current]?.focus()
    const frame = requestAnimationFrame(() => {
      const bounds = menuRef.current?.getBoundingClientRect()
      const trigger = triggerRef.current?.getBoundingClientRect()
      if (bounds && trigger) {
        const popupInset =
          Number.parseFloat(
            getComputedStyle(rootRef.current!).getPropertyValue(
              '--light-select-popup-inset',
            ),
          ) || 0
        let visibleTop = 12
        let visibleBottom = window.innerHeight - 12 - popupInset
        // Keep the popup inside a scrolling dialog body, not behind its footer.
        let ancestor = rootRef.current?.parentElement
        while (ancestor && ancestor !== document.body) {
          if (
            /(auto|scroll|hidden|clip)/.test(
              getComputedStyle(ancestor).overflowY,
            )
          ) {
            const clip = ancestor.getBoundingClientRect()
            visibleTop = Math.max(visibleTop, clip.top + 6)
            visibleBottom = Math.min(visibleBottom, clip.bottom - 6)
          }
          ancestor = ancestor.parentElement
        }
        const above = trigger.top - visibleTop
        const below = visibleBottom - trigger.bottom
        const upward = bounds.height > below && above > below
        setOpensUp(upward)
        setMenuHeight(Math.max(44, Math.min(240, upward ? above : below)))
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [open, disabled])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const selectOption = (nextValue: string) => {
    if (value === undefined) setInternalValue(nextValue)
    onChange?.(nextValue)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const focusOption = (index: number) => {
    if (!options.length) return
    const normalizedIndex = (index + options.length) % options.length
    optionRefs.current[normalizedIndex]?.focus()
  }

  const openMenu = (
    index = options.findIndex((option) => option.value === selectedValue),
  ) => {
    if (disabled || !options.length) return
    openingIndex.current = Math.max(0, index)
    setOpensUp(false)
    setOpen(true)
  }

  const typeAhead = (key: string) => {
    const now = Date.now()
    const nextSearch =
      now - search.current.at < 700 ? search.current.value + key : key
    search.current = { value: nextSearch, at: now }
    const prefix = nextSearch.toLocaleLowerCase('vi')
    const index = options.findIndex((option) =>
      option.label.toLocaleLowerCase('vi').startsWith(prefix),
    )
    if (index >= 0) {
      if (open) focusOption(index)
      else openMenu(index)
    }
  }

  return (
    <div
      ref={rootRef}
      className={`light-select ${className}`.trim()}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          triggerRef.current?.focus()
        } else if (
          event.key.length === 1 &&
          event.key !== ' ' &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          event.preventDefault()
          typeAhead(event.key)
        }
      }}
    >
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button
        id={id}
        ref={triggerRef}
        type="button"
        role="combobox"
        disabled={disabled}
        className="light-select-trigger"
        aria-labelledby={labelledBy}
        aria-controls={`${id}-listbox`}
        aria-haspopup="listbox"
        aria-expanded={open && !disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            openMenu(
              event.key === 'End' || event.key === 'ArrowUp'
                ? options.length - 1
                : 0,
            )
          }
        }}
      >
        <span>{selectedOption?.label ?? placeholder}</span>
        <svg
          className="light-select-chevron"
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      {open && !disabled && (
        <div
          ref={menuRef}
          id={`${id}-listbox`}
          className={`light-select-menu${opensUp ? ' opens-up' : ''}`}
          style={{ maxHeight: menuHeight }}
          role="listbox"
          aria-labelledby={labelledBy ?? id}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(node) => {
                optionRefs.current[index] = node
              }}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={selectedValue === option.value}
              className="light-select-option"
              onClick={() => selectOption(option.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  focusOption(index + 1)
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  focusOption(index - 1)
                }
                if (event.key === 'Home') {
                  event.preventDefault()
                  focusOption(0)
                }
                if (event.key === 'End') {
                  event.preventDefault()
                  focusOption(options.length - 1)
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
