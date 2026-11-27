'use client'

import React, { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { JournalMood } from '@/lib/journal/journal-contract'
import { MOOD_DEFINITIONS, MOOD_ORDER } from '../types'

interface JournalFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  selectedMood: 'all' | JournalMood
  onMoodSelect: (mood: 'all' | JournalMood) => void
  selectedTag: string
  onTagSelect: (tag: string) => void
  availableTags: string[]
}

export function JournalFilters({
  searchQuery,
  onSearchChange,
  selectedMood,
  onMoodSelect,
  selectedTag,
  onTagSelect,
  availableTags,
}: JournalFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch)
    }, 250)
    return () => clearTimeout(timer)
  }, [localSearch, onSearchChange])

  return (
    <div className="filters-container">
      <div className="search-wrap">
        <Search className="search-icon" size={17} aria-hidden="true" />
        <input
          type="search"
          className="search"
          placeholder="Tìm trong nhật ký…"
          aria-label="Tìm trong nhật ký"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
        />
      </div>

      {/* Mood filter chips */}
      <div className="chips" role="toolbar" aria-label="Lọc theo cảm xúc">
        <button
          type="button"
          className="chip"
          aria-pressed={selectedMood === 'all'}
          onClick={() => onMoodSelect('all')}
        >
          Tất cả
        </button>
        {MOOD_ORDER.map((moodKey) => {
          const meta = MOOD_DEFINITIONS[moodKey]
          const isSelected = selectedMood === moodKey
          return (
            <button
              key={moodKey}
              type="button"
              className="chip"
              aria-pressed={isSelected}
              onClick={() => onMoodSelect(isSelected ? 'all' : moodKey)}
            >
              <i style={{ backgroundColor: meta.color }} aria-hidden="true" />
              <span>{meta.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tag filter chips */}
      <div className="chips" role="toolbar" aria-label="Lọc theo chủ đề">
        {availableTags.map((tag) => {
          const isSelected = selectedTag.toLowerCase() === tag.toLowerCase()
          return (
            <button
              key={tag}
              type="button"
              className="chip"
              aria-pressed={isSelected}
              onClick={() => onTagSelect(isSelected ? 'all' : tag)}
            >
              #{tag}
            </button>
          )
        })}
      </div>
    </div>
  )
}
