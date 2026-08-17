import type { ReadingLanguage, SupportedLanguage } from '@textreader/shared'

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en', 'zh', 'ja', 'ko']

export function normalizeSupportedLanguage(
  value: string | null | undefined,
): SupportedLanguage | undefined {
  const base = (value ?? '').trim().toLowerCase().replaceAll('_', '-').split('-')[0]
  if (base === 'en' || base === 'eng') return 'en'
  if (base === 'zh' || base === 'cmn' || base === 'yue') return 'zh'
  if (base === 'ja' || base === 'jpn') return 'ja'
  if (base === 'ko' || base === 'kor') return 'ko'
  return undefined
}

function scriptCount(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0
}

export function detectTextLanguage(text: string, hint?: string): SupportedLanguage {
  const normalizedHint = normalizeSupportedLanguage(hint)
  const japanese = scriptCount(text, /[\p{Script=Hiragana}\p{Script=Katakana}]/gu)
  const korean = scriptCount(text, /\p{Script=Hangul}/gu)
  const chinese = scriptCount(text, /\p{Script=Han}/gu)
  const latin = scriptCount(text, /\p{Script=Latin}/gu)

  if (japanese > 0) return 'ja'
  if (korean > 0) return 'ko'
  if (chinese > 0)
    return normalizedHint === 'ja' || normalizedHint === 'ko' ? normalizedHint : 'zh'
  if (latin > 0) return 'en'
  return normalizedHint ?? 'en'
}

export function resolveReadingLanguage(
  text: string,
  mode: ReadingLanguage,
  hint?: string,
): SupportedLanguage {
  return mode === 'auto' ? detectTextLanguage(text, hint) : mode
}
