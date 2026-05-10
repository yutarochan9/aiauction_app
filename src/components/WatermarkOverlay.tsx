'use client'

export default function WatermarkOverlay({ dense = false }: { dense?: boolean }) {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none z-10"
      aria-hidden="true"
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="wm"
            x="0"
            y="0"
            width="130"
            height="44"
            patternTransform="rotate(-25)"
            patternUnits="userSpaceOnUse"
          >
            <text
              x="8"
              y="22"
              fontFamily="sans-serif"
              fontSize={dense ? '11' : '10'}
              fontWeight="bold"
              fill="rgba(255,255,255,0.22)"
              letterSpacing="4"
            >
              © AIAII
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wm)" />
      </svg>
    </div>
  )
}
