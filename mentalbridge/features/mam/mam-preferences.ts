'use client'

import { useSyncExternalStore } from 'react'

import {
  storedPreference,
  subscribePreferences,
  writePreference,
} from '@/lib/preferences/companion-preferences'

// ADR "User controls": hide and motion are per device, mute is per session.
const HIDDEN_KEY = 'mentalbridge_mam_hidden'
const MUTED_KEY = 'mentalbridge_mam_session_muted'
const MOTION_KEY = 'mentalbridge_mam_motion'

function usePreference(
  key: string,
  expected: string,
  scope: 'local' | 'session',
) {
  return useSyncExternalStore(
    subscribePreferences,
    () => storedPreference(key, expected, scope),
    () => false,
  )
}

/** Read by the dock and, later, by the celebration scheduler (MB-773). */
export function useMamPreferences() {
  return {
    hidden: usePreference(HIDDEN_KEY, 'true', 'local'),
    muted: usePreference(MUTED_KEY, 'true', 'session'),
    motionOff: usePreference(MOTION_KEY, 'reduced', 'local'),
  }
}

export const setMamHidden = (hidden: boolean) =>
  writePreference(HIDDEN_KEY, String(hidden), 'local')

export const setMamMuted = (muted: boolean) =>
  writePreference(MUTED_KEY, String(muted), 'session')

export const setMamMotionOff = (off: boolean) =>
  writePreference(MOTION_KEY, off ? 'reduced' : 'full', 'local')
