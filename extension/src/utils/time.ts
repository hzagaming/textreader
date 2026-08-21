export function estimateSpeechSeconds(text: string, speed: number): number {
  if (!text) return 0
  const cjkPattern =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu
  const cjkCharacters = text.match(cjkPattern)?.length ?? 0
  const latinWords =
    text.replace(cjkPattern, ' ').match(/[\p{Script=Latin}\p{N}]+/gu)?.length ?? 0
  const baseSeconds = (latinWords / 180 + cjkCharacters / 300) * 60
  return Math.max(1, Math.round(baseSeconds / Math.max(0.5, speed)))
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}
