'use client'

import { useEffect, useRef, useState } from 'react'

import AdminContentManager from '@/components/AdminContentManager'

export default function AdminContentSection() {
  const [notice, setNotice] = useState('')
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current)
    },
    [],
  )

  const showNotice = (message: string) => {
    if (clearTimer.current) clearTimeout(clearTimer.current)
    setNotice(message)
    clearTimer.current = setTimeout(() => setNotice(''), 3_200)
  }

  return (
    <>
      <AdminContentManager onNotice={showNotice} />
      {notice && <div role="status">{notice}</div>}
    </>
  )
}
