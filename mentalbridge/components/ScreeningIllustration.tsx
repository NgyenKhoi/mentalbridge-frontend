type ScreeningIllustrationProps = {
  className?: string
}

/** A small, dependency-free infographic for the Care-backed PHQ-9 preview. */
export default function ScreeningIllustration({
  className = '',
}: ScreeningIllustrationProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 620 820"
      role="img"
      aria-label="Minh họa quy trình sàng lọc PHQ-9 do Care chấm điểm"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="screening-paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f9fcf8" />
          <stop offset="1" stopColor="#d9ebe1" />
        </linearGradient>
      </defs>

      <rect width="620" height="820" fill="#eaf3ee" />
      <circle cx="540" cy="74" r="130" fill="#d5e8df" opacity=".72" />
      <circle cx="90" cy="710" r="180" fill="#f4ead4" opacity=".52" />
      <path
        d="M0 182C125 140 210 200 310 158s200-22 310 28v182H0Z"
        fill="#deeee6"
        opacity=".75"
      />

      <text
        x="310"
        y="52"
        textAnchor="middle"
        fill="#1e4a43"
        fontFamily="Georgia, serif"
        fontSize="24"
        fontWeight="700"
      >
        Sàng lọc PHQ-9
      </text>
      <text
        x="310"
        y="78"
        textAnchor="middle"
        fill="#55746c"
        fontFamily="Arial, sans-serif"
        fontSize="11"
        letterSpacing="2"
      >
        HIỂU TÍN HIỆU TRƯỚC KHI CHỌN BƯỚC TIẾP THEO
      </text>

      <g transform="rotate(-8 145 225)">
        <rect
          x="34"
          y="118"
          width="222"
          height="244"
          rx="14"
          fill="url(#screening-paper)"
          stroke="#9bbcaf"
          strokeWidth="2"
        />
        <rect x="34" y="118" width="222" height="38" rx="14" fill="#3d7a6e" />
        <rect x="34" y="143" width="222" height="13" fill="#3d7a6e" />
        <text
          x="145"
          y="143"
          textAnchor="middle"
          fill="#f8fcf8"
          fontFamily="Arial, sans-serif"
          fontSize="14"
          fontWeight="700"
        >
          PHQ-9 · VI-VN
        </text>
        <text
          x="52"
          y="178"
          fill="#526b63"
          fontFamily="Arial, sans-serif"
          fontSize="10"
        >
          Phiên bản đã công bố từ Care
        </text>
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <g
            key={`phq-row-${row}`}
            transform={`translate(52 ${198 + row * 23})`}
          >
            <rect
              width="12"
              height="12"
              rx="3"
              fill="none"
              stroke="#7fa797"
              strokeWidth="1.5"
            />
            <path
              d="M20 6h142"
              stroke="#9bbcaf"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M174 6h27"
              stroke="#d2e2d9"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>

      <g transform="rotate(7 320 224)">
        <rect
          x="214"
          y="118"
          width="222"
          height="244"
          rx="14"
          fill="#fbfdfb"
          stroke="#a6c4b6"
          strokeWidth="2"
        />
        <rect x="214" y="118" width="222" height="38" rx="14" fill="#4f8b7e" />
        <rect x="214" y="143" width="222" height="13" fill="#4f8b7e" />
        <text
          x="325"
          y="143"
          textAnchor="middle"
          fill="#f8fcf8"
          fontFamily="Arial, sans-serif"
          fontSize="14"
          fontWeight="700"
        >
          CARE SERVICE
        </text>
        <text
          x="232"
          y="178"
          fill="#526b63"
          fontFamily="Arial, sans-serif"
          fontSize="10"
        >
          Chấm điểm phía máy chủ
        </text>
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <g
            key={`care-row-${row}`}
            transform={`translate(232 ${198 + row * 23})`}
          >
            <rect
              width="12"
              height="12"
              rx="3"
              fill="none"
              stroke="#7fa797"
              strokeWidth="1.5"
            />
            <path
              d="M20 6h142"
              stroke="#a6c4b6"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M174 6h27"
              stroke="#d2e2d9"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>

      <path
        d="M270 402h80"
        stroke="#c99842"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="m336 388 18 14-18 14"
        fill="none"
        stroke="#c99842"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <g>
        <rect
          x="42"
          y="454"
          width="248"
          height="212"
          rx="24"
          fill="#fffdf9"
          stroke="#d8cfb8"
          strokeWidth="2"
        />
        <text
          x="66"
          y="494"
          fill="#8a5a1f"
          fontFamily="Arial, sans-serif"
          fontSize="12"
          letterSpacing="2"
          fontWeight="700"
        >
          KẾT QUẢ RÕ RÀNG
        </text>
        <rect
          x="70"
          y="528"
          width="188"
          height="92"
          rx="12"
          fill="#f3f6ef"
          stroke="#c5d9cd"
        />
        <path d="M92 590h142" stroke="#9cb8aa" strokeWidth="2" />
        <rect x="104" y="559" width="18" height="31" rx="4" fill="#8ebdb0" />
        <rect x="137" y="543" width="18" height="47" rx="4" fill="#5b9e8c" />
        <rect x="170" y="551" width="18" height="39" rx="4" fill="#c99842" />
        <rect x="203" y="533" width="18" height="57" rx="4" fill="#3d7a6e" />
        <text
          x="164"
          y="644"
          textAnchor="middle"
          fill="#526b63"
          fontFamily="Arial, sans-serif"
          fontSize="12"
        >
          Điểm số dễ hiểu
        </text>
      </g>

      <g>
        <rect
          x="328"
          y="454"
          width="250"
          height="212"
          rx="24"
          fill="#f6fbf7"
          stroke="#b9d5c7"
          strokeWidth="2"
        />
        <circle cx="453" cy="525" r="42" fill="#f5e6c6" />
        <path
          d="M431 529c0-22 11-37 23-37 14 0 25 15 25 37 0 12-8 18-12 22h-24c-4-4-12-10-12-22Z"
          fill="#f0c76c"
          stroke="#8a5a1f"
          strokeWidth="3"
        />
        <path
          d="M440 558h28M443 568h22"
          stroke="#8a5a1f"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M453 472v-17M418 484l-13-13M488 484l13-13M407 521h-18M499 521h18"
          stroke="#3d7a6e"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <text
          x="453"
          y="614"
          textAnchor="middle"
          fill="#1e4a43"
          fontFamily="Georgia, serif"
          fontSize="22"
          fontWeight="700"
        >
          Hiểu tín hiệu
        </text>
        <text
          x="453"
          y="640"
          textAnchor="middle"
          fill="#526b63"
          fontFamily="Arial, sans-serif"
          fontSize="12"
        >
          để chọn bước tiếp theo
        </text>
      </g>

      <g transform="translate(72 720)">
        <circle cx="20" cy="20" r="20" fill="#3d7a6e" />
        <path
          d="M11 20h18M20 11v18"
          stroke="#f8fcf8"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <text
          x="52"
          y="25"
          fill="#1e4a43"
          fontFamily="Arial, sans-serif"
          fontSize="14"
          fontWeight="700"
        >
          Sàng lọc
        </text>
      </g>
      <g transform="translate(264 720)">
        <circle cx="20" cy="20" r="20" fill="#9a8cae" />
        <path
          d="M13 20c0-8 14-8 14 0 0 7-5 11-7 11s-7-4-7-11Z"
          fill="#f8fcf8"
        />
        <text
          x="52"
          y="25"
          fill="#1e4a43"
          fontFamily="Arial, sans-serif"
          fontSize="14"
          fontWeight="700"
        >
          Không chẩn đoán
        </text>
      </g>
      <g transform="translate(438 720)">
        <circle cx="20" cy="20" r="20" fill="#c99842" />
        <path
          d="M20 10v20M10 20h20"
          stroke="#fffaf0"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <text
          x="52"
          y="25"
          fill="#1e4a43"
          fontFamily="Arial, sans-serif"
          fontSize="14"
          fontWeight="700"
        >
          Có phiên bản
        </text>
      </g>
    </svg>
  )
}
