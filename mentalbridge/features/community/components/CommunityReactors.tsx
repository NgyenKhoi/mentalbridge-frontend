'use client'

import { motion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import {
  getCommunityPostReactions,
  type CommunityPostReactionList,
} from '@/features/community/api/browser-community'
import { REACTIONS } from './community-reactions'
import CommunityAvatar from './CommunityAvatar'
import styles from './CommunityReactors.module.css'

const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

function reactedAgo(value: string) {
  const seconds = Math.round((Date.parse(value) - Date.now()) / 1000)
  if (Math.abs(seconds) < 60) return 'Vừa xong'
  const [unit, size] = UNITS.find(([, size]) => Math.abs(seconds) >= size)!
  return new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }).format(
    Math.trunc(seconds / size),
    unit,
  )
}

type Props = Readonly<{ postId: string; onClose: () => void }>

export default function CommunityReactors({ postId, onClose }: Props) {
  const [list, setList] = useState<CommunityPostReactionList>()
  const [failed, setFailed] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const alive = useRef(true)
  const load = useCallback(() => {
    getCommunityPostReactions(postId).then(
      (value) => alive.current && setList(value),
      () => alive.current && setFailed(true),
    )
  }, [postId])
  useEffect(() => {
    alive.current = true
    load()
    root.current?.focus()
    return () => {
      alive.current = false
    }
  }, [load])
  // Keep the popover inside a narrow viewport: shift it left when it overflows the right edge.
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const { right } = element.getBoundingClientRect()
    const over = right - (document.documentElement.clientWidth - 16)
    if (over > 0) element.style.left = `${-over}px`
  }, [])

  return (
    <motion.div
      ref={root}
      role="dialog"
      aria-label="Những người đã bày tỏ cảm xúc"
      tabIndex={-1}
      className={styles.popover}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div className={styles.head}>
        <strong>Đã bày tỏ cảm xúc</strong>
        <button type="button" className={styles.close} onClick={onClose}>
          Đóng
        </button>
      </div>
      {failed ? (
        <div className={styles.note} role="alert">
          <p>Chưa tải được danh sách. Bạn có thể thử lại.</p>
          <button
            type="button"
            className={styles.retry}
            onClick={() => {
              setFailed(false)
              load()
            }}
          >
            Thử lại
          </button>
        </div>
      ) : !list ? (
        <div className={styles.skeleton} role="status" aria-label="Đang tải">
          <span />
          <span />
          <span />
        </div>
      ) : list.items.length === 0 ? (
        <p className={styles.note}>Chưa có ai bày tỏ cảm xúc</p>
      ) : (
        <ul className={styles.list}>
          {list.items.map((item) => {
            const reaction = REACTIONS.find((r) => r.value === item.reaction)
            return (
              <li key={item.communityProfileId} className={styles.row}>
                <CommunityAvatar
                  displayName={item.displayName}
                  avatarPreset={item.avatarPreset}
                />
                <div className={styles.who}>
                  <div className={styles.name}>
                    {item.self ? 'Bạn' : item.displayName}
                  </div>
                  <div className={styles.meta}>
                    {reactedAgo(item.reactedAt)}
                  </div>
                </div>
                <div className={styles.kind}>
                  <span aria-hidden="true">{reaction?.emoji ?? '•'}</span>{' '}
                  {reaction?.label ?? 'Cảm xúc'}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </motion.div>
  )
}
