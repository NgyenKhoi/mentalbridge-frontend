'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { ResourcesResponse } from '@/app/api/resources/route'
import type { components } from '@/contracts/content.generated'

type ResourceSummary = components['schemas']['ResourceSummary']

interface ResourcesListProps {
  category?: string
  limit?: number
  className?: string
}

type LoadingState =
  'idle' | 'loading' | 'success' | 'error' | 'empty' | 'timeout' | 'unavailable'

export default function ResourcesList({
  category,
  limit = 6,
  className = '',
}: ResourcesListProps) {
  const [resources, setResources] = useState<ResourceSummary[]>([])
  const [loadingState, setLoadingState] = useState<LoadingState>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const fetchResources = async () => {
      setLoadingState('loading')

      try {
        const params = new URLSearchParams()
        if (category) params.set('category', category)
        params.set('limit', limit.toString())

        const response = await fetch(`/api/resources?${params.toString()}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })

        if (response.status === 504) {
          setLoadingState('timeout')
          setErrorMessage('Dịch vụ đang bận, vui lòng thử lại sau')
          return
        }

        if (response.status >= 500) {
          setLoadingState('unavailable')
          setErrorMessage('Dịch vụ tạm thời không khả dụng')
          return
        }

        if (!response.ok) {
          setLoadingState('error')
          setErrorMessage('Không thể tải tài liệu')
          return
        }

        const data: ResourcesResponse = await response.json()

        // Check if backend returned unavailable state
        if (data.unavailable) {
          setLoadingState('unavailable')
          setErrorMessage(data.message || 'Tài nguyên tạm thời không khả dụng')
          return
        }

        if (data.items.length === 0) {
          setLoadingState('empty')
          return
        }

        setResources(data.items)
        setLoadingState('success')
      } catch (error) {
        console.error('[ResourcesList] Fetch error:', error)
        setLoadingState('unavailable')
        setErrorMessage('Không thể kết nối đến dịch vụ')
      }
    }

    fetchResources()
  }, [category, limit])

  // Loading state
  if (loadingState === 'loading') {
    return (
      <div className={`resources-list ${className}`}>
        <div className="resources-header">
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}>
            Tài liệu hữu ích
          </h3>
          <p style={{ fontSize: '0.95rem', opacity: 0.7, marginTop: '0.5rem' }}>
            Đang tải...
          </p>
        </div>
        <div
          className="resources-grid"
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}
        >
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              style={{
                background: 'var(--surface-glass)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius)',
                padding: '1.5rem',
                minHeight: '120px',
                animation: 'pulse 1.5s infinite',
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (loadingState === 'empty') {
    return (
      <div className={`resources-list ${className}`}>
        <div
          style={{
            textAlign: 'center',
            padding: '2rem',
            background: 'var(--surface-glass)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius)',
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{ margin: '0 auto 1rem', opacity: 0.4 }}
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <p style={{ fontSize: '0.95rem', opacity: 0.7 }}>
            Hiện chưa có tài liệu nào
          </p>
        </div>
      </div>
    )
  }

  // Error/Timeout/Unavailable states
  if (
    loadingState === 'error' ||
    loadingState === 'timeout' ||
    loadingState === 'unavailable'
  ) {
    return (
      <div className={`resources-list ${className}`}>
        <div
          style={{
            textAlign: 'center',
            padding: '2rem',
            background: 'var(--surface-glass)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--radius)',
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{
              margin: '0 auto 1rem',
              opacity: 0.6,
              color: 'var(--amber)',
            }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ fontSize: '0.95rem', opacity: 0.8 }}>{errorMessage}</p>
        </div>
      </div>
    )
  }

  // Success state
  const getCategoryLabel = (cat: ResourceSummary['category']) => {
    const labels: Record<ResourceSummary['category'], string> = {
      ARTICLE: 'Bài viết',
      VIDEO: 'Video',
      BREATHING: 'Hơi thở',
      MEDITATION: 'Thiền',
      JOURNALING: 'Nhật ký',
      COMMUNITY: 'Cộng đồng',
    }
    return labels[cat] || cat
  }

  return (
    <motion.div
      className={`resources-list ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
    >
      <div className="resources-header" style={{ marginBottom: '1.5rem' }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.3rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          Tài liệu hữu ích
        </h3>
        <p style={{ fontSize: '0.95rem', opacity: 0.7, marginTop: '0.5rem' }}>
          Tài nguyên được chuyên gia xem xét và đề xuất
        </p>
      </div>

      <div
        className="resources-grid"
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        }}
      >
        {resources.map((resource, index) => (
          <motion.a
            key={resource.id}
            href={resource.externalUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            style={{
              display: 'block',
              background: 'var(--surface-glass)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              padding: '1.5rem',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'all 0.2s ease',
            }}
            whileHover={{
              y: -4,
              borderColor: 'var(--teal)',
              boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '0.75rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--teal)',
                  opacity: 0.8,
                }}
              >
                {getCategoryLabel(resource.category)}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ opacity: 0.4 }}
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </div>

            <h4
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1rem',
                marginBottom: '0.5rem',
                lineHeight: 1.4,
              }}
            >
              {resource.title}
            </h4>

            {resource.summary && (
              <p
                style={{
                  fontSize: '0.9rem',
                  opacity: 0.7,
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {resource.summary}
              </p>
            )}
          </motion.a>
        ))}
      </div>

      {/* Future features - marked as unavailable */}
      <div
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'var(--surface-glass)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          opacity: 0.6,
        }}
      >
        <p style={{ fontSize: '0.9rem', textAlign: 'center' }}>
          <strong>Sắp có:</strong> Đăng ký nhận tư vấn chuyên gia và tham gia
          nhóm hỗ trợ
          <span
            style={{
              marginLeft: '0.5rem',
              fontSize: '0.8rem',
              padding: '0.25rem 0.5rem',
              background: 'var(--line)',
              borderRadius: '4px',
            }}
          >
            Chưa khả dụng
          </span>
        </p>
      </div>
    </motion.div>
  )
}
