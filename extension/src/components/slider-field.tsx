import { useRef, useState } from 'react'

interface SliderFieldProps {
  label: string
  value: number
  minimum: number
  maximum: number
  step: number
  formatValue: (value: number) => string
  onChange: (value: number) => Promise<boolean>
}

export function SliderField({
  label,
  value,
  minimum,
  maximum,
  step,
  formatValue,
  onChange,
}: SliderFieldProps) {
  const [control, setControl] = useState({ external: value, draft: value, saved: value })
  const commitVersion = useRef(0)
  const current =
    control.external === value ? control : { external: value, draft: value, saved: value }

  const commit = async (next: number) => {
    if (next === current.saved) return
    setControl({ ...current, draft: next, saved: next })
    const version = ++commitVersion.current
    const saved = await onChange(next)
    if (version !== commitVersion.current || saved) return
    setControl({ external: value, draft: value, saved: value })
  }

  const valueLabel = formatValue(current.draft)

  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-[12px] font-medium">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--tr-muted)]">{valueLabel}</span>
      </span>
      <input
        className="h-1.5 w-full cursor-pointer"
        type="range"
        min={minimum}
        max={maximum}
        step={step}
        value={current.draft}
        aria-label={label}
        aria-valuetext={valueLabel}
        onChange={(event) =>
          setControl({ ...current, draft: Number(event.target.value) })
        }
        onPointerUp={(event) => void commit(Number(event.currentTarget.value))}
        onKeyUp={(event) => void commit(Number(event.currentTarget.value))}
        onBlur={(event) => void commit(Number(event.currentTarget.value))}
      />
    </label>
  )
}
