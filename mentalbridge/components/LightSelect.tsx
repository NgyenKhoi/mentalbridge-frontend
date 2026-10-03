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
}: LightSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(defaultValue)
  const selectedValue = value ?? internalValue
  const selectedOption = options.find(
    (option) => option.value === selectedValue,
  )

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
  }

  const focusOption = (index: number) => {
    if (!options.length) return
    const normalizedIndex = (index + options.length) % options.length
    optionRefs.current[normalizedIndex]?.focus()
  }

  return (
    <div
      ref={rootRef}
      className={`light-select ${className}`.trim()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false)
          rootRef.current
            ?.querySelector<HTMLButtonElement>('.light-select-trigger')
            ?.focus()
        }
      }}
    >
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button
        id={id}
        type="button"
        className="light-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            requestAnimationFrame(() => {
              const selectedIndex = Math.max(
                0,
                options.findIndex((option) => option.value === selectedValue),
              )
              focusOption(
                event.key === 'ArrowDown' ? selectedIndex : selectedIndex - 1,
              )
            })
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
      {open && (
        <div className="light-select-menu" role="listbox" aria-labelledby={id}>
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(node) => {
                optionRefs.current[index] = node
              }}
              type="button"
              role="option"
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
