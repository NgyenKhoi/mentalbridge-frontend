// Presentation only: never changes room identity or media ownership.
export type PipPoint = { x: number; y: number }
export type PipBounds = {
  width: number
  height: number
  pipWidth: number
  pipHeight: number
}
export function clampPip(point: PipPoint, bounds: PipBounds): PipPoint {
  return {
    x: Math.max(12, Math.min(point.x, bounds.width - bounds.pipWidth - 12)),
    y: Math.max(64, Math.min(point.y, bounds.height - bounds.pipHeight - 96)),
  }
}
export function pipCorner(corner: number, bounds: PipBounds): PipPoint {
  return clampPip(
    {
      x:
        corner === 1 || corner === 2 ? 20 : bounds.width - bounds.pipWidth - 24,
      y: corner >= 2 ? 72 : bounds.height - bounds.pipHeight - 96,
    },
    bounds,
  )
}
