interface SliderFieldProps {
  label: string
  valueLabel: string
  value: number
  minimum: number
  maximum: number
  step: number
  onChange: (value: number) => void
}

export function SliderField({
  label,
  valueLabel,
  value,
  minimum,
  maximum,
  step,
  onChange,
}: SliderFieldProps) {
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
        value={value}
        aria-label={label}
        aria-valuetext={valueLabel}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
