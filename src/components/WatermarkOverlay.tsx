'use client'

export default function WatermarkOverlay({ dense = false }: { dense?: boolean }) {
  const count = dense ? 120 : 60
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none z-10"
      aria-hidden="true"
    >
      <div
        className="absolute flex flex-wrap content-start justify-around p-2"
        style={{ inset: '-20%', transform: 'rotate(-25deg) scale(1.5)', rowGap: '18px', columnGap: '0px' }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            className="text-white font-bold tracking-widest whitespace-nowrap select-none"
            style={{ fontSize: dense ? '11px' : '10px', opacity: 0.22, letterSpacing: '0.3em' }}
          >
            © AIAII
          </span>
        ))}
      </div>
    </div>
  )
}
