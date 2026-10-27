'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

import {
  resolveMamTarget,
  type MamTarget,
  type MamTargetDescriptor,
  type MamTargetKind,
} from './mam-targets'

// Elements and the page target register here from props. The dock host reads
// them; with the flag off nothing listens, so registering costs nothing.
const elements = new Map<Element, MamTarget>()
let pageTarget: MamTarget | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export function subscribeMamTargets(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The nearest registered ancestor of `node`, or null. */
export function findMamTarget(
  node: EventTarget | null,
): { element: Element; target: MamTarget } | null {
  for (
    let element = node instanceof Element ? node : null;
    element;
    element = element.parentElement
  ) {
    const target = elements.get(element)
    if (target) return { element, target }
  }
  return null
}

export function findMamTargetElement(kind: MamTargetKind) {
  for (const [element, target] of elements)
    if (target.kind === kind && element.isConnected) return element
  return null
}

export const isMamTargetMounted = (element: Element) => elements.has(element)

export const getMamPageTarget = () => pageTarget

/**
 * Registers the element the returned ref lands on. Only the kind and
 * allowlisted context IDs are kept; an invalid descriptor registers nothing.
 */
export function useMamTarget(descriptor: MamTargetDescriptor | null) {
  const [element, setElement] = useState<Element | null>(null)
  const kind = descriptor?.kind ?? null
  const context = JSON.stringify(descriptor?.context ?? {})
  useEffect(() => {
    const target = kind
      ? resolveMamTarget({ kind, context: JSON.parse(context) })
      : null
    if (!element || !target) return
    elements.set(element, target)
    notify()
    return () => {
      elements.delete(element)
      notify()
    }
  }, [element, kind, context])
  return setElement
}

/** Registers the page-level target behind "Hỏi Mầm về trang này". */
export function useMamPageTarget(descriptor: MamTargetDescriptor | null) {
  const kind = descriptor?.kind ?? null
  useEffect(() => {
    const target = kind ? resolveMamTarget({ kind }) : null
    if (!target?.page) return
    pageTarget = target
    notify()
    return () => {
      if (pageTarget === target) pageTarget = null
      notify()
    }
  }, [kind])
}

export function useMamPageTargetValue() {
  return useSyncExternalStore(subscribeMamTargets, getMamPageTarget, () => null)
}
