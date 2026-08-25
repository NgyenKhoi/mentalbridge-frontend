'use client'

import { useEffect, useRef, useState } from 'react'

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
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(defaultValue)
  const selectedValue = value ?? internalValue
  const selectedOption = options.find(option => option.value === selectedValue)

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

  return (
    <div ref={rootRef} className={`light-select ${className}`.trim()}>
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button
        id={id}
        type="button"
        className="light-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        onKeyDown={event => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        <span>{selectedOption?.label ?? placeholder}</span>
        <span className="light-select-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="light-select-menu" role="listbox" aria-labelledby={id}>
          {options.map(option => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selectedValue === option.value}
              className="light-select-option"
              onClick={() => selectOption(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
