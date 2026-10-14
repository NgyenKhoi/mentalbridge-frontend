'use client'

import {
  Component,
  type ComponentType,
  type ReactNode,
  useId,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  ChevronDown,
  ChevronUp,
  Leaf,
  Pause,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react'

import { useReactiveReducedMotion } from '@/lib/animations/use-reduced-motion'
import {
  companionStateCopy,
  companionSurfaceCopy,
  type SupportPlanCompanionState,
  type SupportPlanCompanionSurface,
} from './support-plan-companion-state'
import type { ContextualCompanionSnapshot } from './support-plan-contextual-companion'

import './support-plan-companion.css'

const MOTION_STORAGE_KEY = 'mentalbridge_support_plan_companion_motion'
const MUTED_STORAGE_KEY = 'mentalbridge_support_plan_companion_session_muted'
const PREFERENCE_EVENT = 'mentalbridge:companion-preference'
// Mute is session-only by policy. The same legacy key in localStorage is
// deliberately ignored; reduced motion remains an explicit durable preference.
const memoryPreferences = new Map<string, string>()
const volatilePreferences = new Set<string>()

type PreferenceScope = 'local' | 'session'

function subscribePreferences(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null) {
      volatilePreferences.clear()
    } else {
      volatilePreferences.delete(event.key)
    }
    onChange()
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(PREFERENCE_EVENT, onChange)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(PREFERENCE_EVENT, onChange)
  }
}

function preferenceStorage(scope: PreferenceScope) {
  return scope === 'session' ? window.sessionStorage : window.localStorage
}

function readPreference(key: string, scope: PreferenceScope) {
  if (volatilePreferences.has(key)) {
    return memoryPreferences.get(key) ?? null
  }
  try {
    const value = preferenceStorage(scope).getItem(key)
    if (value === null) {
      memoryPreferences.delete(key)
    } else {
      memoryPreferences.set(key, value)
    }
    return value
  } catch {
    return memoryPreferences.get(key) ?? null
  }
}

function storedPreference(
  key: string,
  expected: string,
  scope: PreferenceScope,
) {
  return readPreference(key, scope) === expected
}

function writePreference(key: string, value: string, scope: PreferenceScope) {
  memoryPreferences.set(key, value)
  try {
    preferenceStorage(scope).setItem(key, value)
    volatilePreferences.delete(key)
  } catch {
    volatilePreferences.add(key)
    // Restricted storage keeps the preference for the current page lifetime.
  }
  window.dispatchEvent(new Event(PREFERENCE_EVENT))
}

export type SupportPlanCompanionCharacterProps = Readonly<{
  state: SupportPlanCompanionState
  reducedMotion: boolean
}>

type Props = Readonly<{
  state: SupportPlanCompanionState
  surface: SupportPlanCompanionSurface
  defaultExpanded?: boolean
  CharacterRenderer?: ComponentType<SupportPlanCompanionCharacterProps>
  contextual?: ContextualCompanionSnapshot
  onContextualDismiss?: () => void
}>

export function useSupportPlanCompanionMuted() {
  return useSyncExternalStore(
    subscribePreferences,
    () => storedPreference(MUTED_STORAGE_KEY, 'true', 'session'),
    () => false,
  )
}

function StaticCharacter() {
  return (
    <div className="support-plan-companion-static" aria-hidden="true">
      <Leaf size={30} strokeWidth={1.7} />
    </div>
  )
}

function DefaultCharacter({
  state,
  reducedMotion,
}: SupportPlanCompanionCharacterProps) {
  return (
    <div
      className="support-plan-companion-character"
      data-state={state}
      data-motion={reducedMotion ? 'reduced' : 'full'}
      aria-hidden="true"
    >
      <span className="support-plan-companion-halo" />
      <span className="support-plan-companion-orbit" />
      <span className="support-plan-companion-core">
        <Leaf size={34} strokeWidth={1.6} />
      </span>
    </div>
  )
}

class CharacterBoundary extends Component<
  Readonly<{
    children: ReactNode
    fallback: ReactNode
    resetKey: string
  }>,
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    // Rendering degrades locally. No private context or runtime error is logged.
  }

  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export default function SupportPlanCompanionShell({
  state,
  surface,
  defaultExpanded = true,
  CharacterRenderer = DefaultCharacter,
  contextual,
  onContextualDismiss,
}: Props) {
  const bodyId = useId()
  const systemReducedMotion = useReactiveReducedMotion()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const muted = useSupportPlanCompanionMuted()
  const userReducedMotion = useSyncExternalStore(
    subscribePreferences,
    () => storedPreference(MOTION_STORAGE_KEY, 'reduced', 'local'),
    () => false,
  )

  const reducedMotion = systemReducedMotion || userReducedMotion
  const copy = companionStateCopy[state]
  const displayedExpanded = expanded || Boolean(contextual)

  const toggleMuted = () => {
    writePreference(MUTED_STORAGE_KEY, String(!muted), 'session')
  }

  const toggleMotion = () => {
    writePreference(
      MOTION_STORAGE_KEY,
      userReducedMotion ? 'full' : 'reduced',
      'local',
    )
  }

  return (
    <aside
      className={`support-plan-companion ${displayedExpanded ? 'is-expanded' : 'is-collapsed'}`}
      aria-label="Bạn đồng hành trong kế hoạch hỗ trợ"
      data-motion={reducedMotion ? 'reduced' : 'full'}
      data-muted={muted}
    >
      <div className="support-plan-companion-header">
        <div className="support-plan-companion-identity">
          <span className="support-plan-companion-mark" aria-hidden="true">
            <Leaf size={20} strokeWidth={1.8} />
          </span>
          <span className="support-plan-companion-title">
            <strong>Bạn đồng hành</strong>
            <small>{copy.label}</small>
          </span>
        </div>

        <div className="support-plan-companion-controls">
          {displayedExpanded && (
            <>
              <button
                type="button"
                aria-label={
                  muted
                    ? 'Bật lời nhắc của bạn đồng hành'
                    : 'Tắt lời nhắc của bạn đồng hành'
                }
                aria-pressed={muted}
                onClick={toggleMuted}
              >
                {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
              </button>
              <button
                type="button"
                aria-label={
                  reducedMotion ? 'Bật chuyển động nhẹ' : 'Giảm chuyển động'
                }
                aria-pressed={reducedMotion}
                disabled={systemReducedMotion}
                title={
                  systemReducedMotion
                    ? 'Thiết bị đang ưu tiên giảm chuyển động'
                    : undefined
                }
                onClick={toggleMotion}
              >
                {reducedMotion ? <Pause size={19} /> : <Waves size={19} />}
              </button>
            </>
          )}
          <button
            type="button"
            aria-controls={bodyId}
            aria-expanded={displayedExpanded}
            aria-label={
              displayedExpanded
                ? 'Thu gọn bạn đồng hành'
                : 'Mở rộng bạn đồng hành'
            }
            onClick={() => {
              if (contextual) onContextualDismiss?.()
              setExpanded(!displayedExpanded)
            }}
          >
            {displayedExpanded ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </button>
        </div>
      </div>

      <div
        id={bodyId}
        className="support-plan-companion-body"
        hidden={!displayedExpanded}
      >
        <CharacterBoundary
          resetKey={`${CharacterRenderer.name}:${state}`}
          fallback={<StaticCharacter />}
        >
          <CharacterRenderer state={state} reducedMotion={reducedMotion} />
        </CharacterBoundary>

        <div className="support-plan-companion-copy">
          <span>{copy.label}</span>
          <p>{copy.description}</p>
          <small>{companionSurfaceCopy[surface]}</small>
        </div>

        {contextual && (
          <div
            className="support-plan-companion-contextual-tray"
            data-status={contextual.status}
            {...(contextual.status === 'loading' || muted
              ? {}
              : { role: 'status', 'aria-live': 'polite' })}
          >
            <div>
              <strong>
                {contextual.status === 'loading'
                  ? 'Đang chuẩn bị lời giải thích…'
                  : 'Giải thích theo hoạt động'}
              </strong>
              <button
                type="button"
                aria-label="Đóng lời giải thích"
                onClick={onContextualDismiss}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <small>{contextual.actionTitle}</small>
            {contextual.status !== 'loading' && <p>{contextual.message}</p>}
            {contextual.status !== 'loading' && (
              <small>
                {contextual.status === 'ready'
                  ? 'Nội dung do AI diễn đạt từ thông tin kế hoạch đã duyệt.'
                  : 'Phản hồi dự phòng; hoạt động gốc vẫn giữ nguyên.'}
              </small>
            )}
          </div>
        )}

        <p className="support-plan-companion-authority">
          Bạn luôn là người quyết định thay đổi trong kế hoạch.
        </p>
      </div>
    </aside>
  )
}
