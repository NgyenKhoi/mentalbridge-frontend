export type TourRect = { x: number; y: number; width: number; height: number }
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto'
export const TOUR_PADDING = 8
const GAP = 20
const MARGIN = 16
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)))

export function spotlightRect(
  target: TourRect,
  width: number,
  height: number,
): TourRect {
  const x = clamp(target.x - TOUR_PADDING, 0, width)
  const y = clamp(target.y - TOUR_PADDING, 0, height)
  return {
    x,
    y,
    width: Math.max(
      0,
      Math.min(width, target.x + target.width + TOUR_PADDING) - x,
    ),
    height: Math.max(
      0,
      Math.min(height, target.y + target.height + TOUR_PADDING) - y,
    ),
  }
}

export function tooltipLayout(
  target: TourRect,
  viewport: { width: number; height: number; top: number; bottom: number },
  cardHeight: number,
  preferred: TourPlacement = 'auto',
) {
  const { width, height, top, bottom } = viewport
  const left = MARGIN,
    right = width - MARGIN,
    upper = top + MARGIN,
    lower = height - bottom - MARGIN
  const cardWidth = Math.min(360, Math.max(0, right - left))
  const spaces = {
    top: target.y - GAP - upper,
    bottom: lower - target.y - target.height - GAP,
    left: target.x - GAP - left,
    right: right - target.x - target.width - GAP,
  }
  const candidates = (['top', 'bottom', 'left', 'right'] as const).map(
    (side) => {
      const vertical = side === 'top' || side === 'bottom'
      return {
        side,
        width: vertical ? cardWidth : Math.min(cardWidth, spaces[side]),
        height: vertical ? spaces[side] : lower - upper,
      }
    },
  )
  const fits = candidates.filter(
    (c) => c.width >= Math.min(260, cardWidth) && c.height >= cardHeight,
  )
  const chosen =
    fits.find((c) => c.side === preferred) ??
    fits[0] ??
    candidates
      .filter((c) => c.width >= Math.min(260, cardWidth))
      .sort((a, b) => b.height - a.height)[0] ??
    candidates[0]!
  const h = Math.min(
    cardHeight,
    Math.max(0, chosen.height < 180 ? lower - upper : chosen.height),
    Math.max(0, lower - upper),
  )
  const w = Math.min(cardWidth, Math.max(0, chosen.width))
  const cx = target.x + target.width / 2,
    cy = target.y + target.height / 2
  const x = clamp(
    chosen.side === 'left'
      ? target.x - GAP - w
      : chosen.side === 'right'
        ? target.x + target.width + GAP
        : cx - w / 2,
    left,
    right - w,
  )
  const y = clamp(
    chosen.side === 'top'
      ? target.y - GAP - h
      : chosen.side === 'bottom'
        ? target.y + target.height + GAP
        : cy - h / 2,
    upper,
    lower - h,
  )
  const vertical = chosen.side === 'top' || chosen.side === 'bottom'
  return {
    x,
    y,
    width: w,
    height: h,
    side: chosen.side,
    arrowX: vertical
      ? clamp(cx, x + 20, x + w - 20)
      : chosen.side === 'left'
        ? x + w + 9
        : x - 9,
    arrowY: vertical
      ? chosen.side === 'top'
        ? y + h + 9
        : y - 9
      : clamp(cy, y + 20, y + h - 20),
  }
}
