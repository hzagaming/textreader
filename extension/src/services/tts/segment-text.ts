const PROTECTED_DOT = '\uE000'

function protectDots(text: string): string {
  return text
    .replace(/\b(?:e\.g|i\.e)\./giu, (match) => match.replaceAll('.', PROTECTED_DOT))
    .replace(/\b(?:[A-Z]\.){2,}/gu, (match) => match.replaceAll('.', PROTECTED_DOT))
    .replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc)\./giu, (match) =>
      match.replace('.', PROTECTED_DOT),
    )
    .replace(/(\d)\.(\d)/gu, `$1${PROTECTED_DOT}$2`)
}

function restoreDots(text: string): string {
  return text.replaceAll(PROTECTED_DOT, '.')
}

function fallbackSegments(text: string): string[] {
  return (
    text
      .match(/.*?(?:[.!?。！？]+(?:["'”’）\]]+)?(?=\s|[^\s]|$)|$)/gu)
      ?.filter(Boolean) ?? [text]
  )
}

export function segmentText(text: string, locale?: string): string[] {
  const normalized = text.replace(/\s+/gu, ' ').trim()
  if (!normalized) return []

  const protectedText = protectDots(normalized)
  const segments =
    typeof Intl.Segmenter === 'function'
      ? Array.from(
          new Intl.Segmenter(locale, { granularity: 'sentence' }).segment(protectedText),
          ({ segment }) => segment,
        )
      : fallbackSegments(protectedText)

  return segments.map((segment) => restoreDots(segment).trim()).filter(Boolean)
}
