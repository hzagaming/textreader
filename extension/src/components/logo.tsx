interface LogoProps {
  compact?: boolean
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5" role="img" aria-label="TextReader">
      <span className="grid size-8 place-items-center rounded-[10px] bg-[var(--tr-accent)] text-[var(--tr-accent-text)] shadow-sm">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden="true">
          <path
            d="M5.5 6.5h7a3 3 0 0 1 3 3v8h-7a3 3 0 0 0-3 3v-14Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M15.5 10.5 19 8v8l-3.5-2.5" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-[-0.02em]">TextReader</span>
      )}
    </div>
  )
}
