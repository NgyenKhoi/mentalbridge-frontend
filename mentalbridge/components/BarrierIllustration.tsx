type BarrierIllustrationProps = {
  variant: 'mind' | 'awareness' | 'access'
}

/**
 * Inline illustrations keep the cards self-contained and sharp at every size.
 * The small line and node animations add a calm illustrative pulse rather than
 * making the content feel like a static placeholder image.
 */
export default function BarrierIllustration({ variant }: BarrierIllustrationProps) {
  return (
    <div className={`barrier-art barrier-art--${variant}`} aria-hidden="true">
      <svg viewBox="0 0 240 180" role="presentation">
        {variant === 'mind' && (
          <g className="barrier-art__illustration barrier-art__illustration--mind">
            <path className="barrier-art__bubble" d="M30 34c0-14 17-24 38-24s38 10 38 24-17 24-38 24c-8 0-15-2-21-5L31 62l4-14c-3-4-5-9-5-14Z" />
            <circle className="barrier-art__bubble-dot" cx="51" cy="34" r="3" />
            <circle className="barrier-art__bubble-dot" cx="67" cy="34" r="3" />
            <circle className="barrier-art__bubble-dot" cx="83" cy="34" r="3" />
            <circle className="barrier-art__person-head" cx="123" cy="77" r="12" />
            <path className="barrier-art__person-hair" d="M111 76c1-13 11-18 20-13 5 3 7 8 6 14-7-2-15-1-26-1Z" />
            <path className="barrier-art__person-body" d="M116 89c-7 10-10 24-12 38l-9 29h17l11-25 8 25h17l-8-33c-3-12-7-25-13-34Z" />
            <path className="barrier-art__person-arm" d="M116 96c-9 7-13 17-16 28M137 98c9 6 13 14 16 24" />
            <path className="barrier-art__thought" d="M174 40c-14 0-25 8-25 19 0 4 2 8 5 11l-3 11 12-7c3 1 7 2 11 2 14 0 25-8 25-19s-11-17-25-17Z" />
            <circle className="barrier-art__thought-dot" cx="164" cy="59" r="2.5" />
            <circle className="barrier-art__thought-dot" cx="175" cy="59" r="2.5" />
            <circle className="barrier-art__thought-dot" cx="186" cy="59" r="2.5" />
            <path className="barrier-art__line barrier-art__line--soft" d="M54 132c21-11 35-12 49-2" />
            <circle className="barrier-art__node" cx="55" cy="132" r="3.5" />
          </g>
        )}

        {variant === 'awareness' && (
          <g className="barrier-art__illustration barrier-art__illustration--awareness">
            <path className="barrier-art__brain" d="M120 35c-10-12-31-9-36 7-14-4-25 8-21 21-14 7-13 27 1 34-7 14 5 29 20 27 7 15 28 16 37 4 9 12 30 11 37-4 15 2 27-13 20-27 14-7 15-27 1-34 4-13-7-25-21-21-5-16-26-19-38-7Z" />
            <path className="barrier-art__brain-line" d="M120 37v116M116 49c-13 3-13 17-2 21s9 14 1 19-10 16 1 21M124 52c12 2 13 14 3 20s-7 15 2 19 10 15-2 22" />
            <path className="barrier-art__line" d="M78 75c13 1 20 6 25 14M142 71c10 2 15 8 19 17M83 112c12-3 21-1 29 8M134 113c12-4 21-2 28 7" />
            <circle className="barrier-art__node barrier-art__node--one" cx="103" cy="89" r="4" />
            <circle className="barrier-art__node barrier-art__node--two" cx="142" cy="88" r="4" />
            <circle className="barrier-art__node" cx="112" cy="121" r="4" />
            <circle className="barrier-art__node" cx="158" cy="120" r="4" />
          </g>
        )}

        {variant === 'access' && (
          <g className="barrier-art__illustration barrier-art__illustration--access">
            <path className="barrier-art__flow-line" d="M36 91h38m18 0h22m18 0h24m18 0h29" />
            <path className="barrier-art__flow-arrow" d="m70 85 7 6-7 6m40-12 7 6-7 6m42-12 7 6-7 6" />
            <circle className="barrier-art__flow-node" cx="36" cy="91" r="12" />
            <circle className="barrier-art__flow-node" cx="84" cy="91" r="12" />
            <circle className="barrier-art__flow-node" cx="132" cy="91" r="12" />
            <circle className="barrier-art__flow-node" cx="180" cy="91" r="12" />
            <circle className="barrier-art__flow-person" cx="36" cy="87" r="4" />
            <path className="barrier-art__flow-person" d="M29 101c3-7 11-7 14 0" />
            <path className="barrier-art__flow-card" d="M77 85h14v10H77zM125 85h14v10h-14zM173 85h14v10h-14z" />
            <path className="barrier-art__flow-heart" d="M180 108c-7-7-16 3 0 13 16-10 7-20 0-13Z" />
            <path className="barrier-art__line barrier-art__line--soft" d="M48 140c39 13 90 13 137-1" />
            <circle className="barrier-art__node" cx="52" cy="139" r="3.5" />
            <circle className="barrier-art__node" cx="188" cy="139" r="3.5" />
          </g>
        )}
      </svg>
    </div>
  )
}
