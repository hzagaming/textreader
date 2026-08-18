interface Prosody {
  rate: number
  pitch: number
  volume: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100
}

export function naturalProsody(text: string, base: Prosody, enabled: boolean): Prosody {
  if (!enabled) return base

  let { rate, pitch, volume } = base
  const closing = `["'”’）)\\]]*`
  if (new RegExp(`(?:…|\\.{2,})${closing}$`, 'u').test(text)) {
    rate *= 0.92
    pitch -= 0.04
  } else if (new RegExp(`[?？]${closing}$`, 'u').test(text)) {
    rate *= 0.97
    pitch += 0.08
  } else if (new RegExp(`[!！]${closing}$`, 'u').test(text)) {
    rate *= 1.03
    pitch += 0.06
    volume += 0.02
  }

  return {
    rate: rounded(clamp(rate, 0.1, 10)),
    pitch: rounded(clamp(pitch, 0, 2)),
    volume: rounded(clamp(volume, 0, 1)),
  }
}
