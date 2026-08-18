const PROTECTED_DOT = '\uE000'
const MAX_SEGMENT_LENGTH = 280
const MIN_CLAUSE_LENGTH = 80

function protectTokenDots(match: string): string {
  const trailing = match.match(/[.!?。！？,;:，；：]+$/u)?.[0] ?? ''
  const token = trailing ? match.slice(0, -trailing.length) : match
  return `${token.replaceAll('.', PROTECTED_DOT)}${trailing}`
}

function protectDots(text: string): string {
  return text
    .replace(
      /(?:https?:\/\/|www\.)[^\s<>"']+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,}(?:\/[^\s<>"']*)?/giu,
      protectTokenDots,
    )
    .replace(/\b(?:e\.g|i\.e)\./giu, (match) => match.replaceAll('.', PROTECTED_DOT))
    .replace(/\b(?:[A-Z]\.){2,}/gu, (match) => match.replaceAll('.', PROTECTED_DOT))
    .replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|No|Fig|Eq)\./giu, (match) =>
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

function splitLongSegment(text: string): string[] {
  if (text.length <= MAX_SEGMENT_LENGTH) return [text]

  const parts: string[] = []
  let remaining = text
  while (remaining.length > MAX_SEGMENT_LENGTH) {
    const window = remaining.slice(0, MAX_SEGMENT_LENGTH + 1)
    let boundary = -1
    for (const match of window.matchAll(/[,;:，；：、—–]/gu)) {
      const candidate = (match.index ?? 0) + match[0].length
      if (candidate >= MIN_CLAUSE_LENGTH) boundary = candidate
    }
    if (boundary < MIN_CLAUSE_LENGTH) {
      const whitespace = window.lastIndexOf(' ')
      boundary = whitespace >= MIN_CLAUSE_LENGTH ? whitespace : MAX_SEGMENT_LENGTH
    }
    const previousCode = remaining.charCodeAt(boundary - 1)
    if (previousCode >= 0xd800 && previousCode <= 0xdbff) boundary -= 1
    parts.push(remaining.slice(0, boundary).trim())
    remaining = remaining.slice(boundary).trim()
  }
  if (remaining) parts.push(remaining)
  return parts.filter(Boolean)
}

function segmentWithIntl(text: string, locale?: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return fallbackSegments(text)
  try {
    return Array.from(
      new Intl.Segmenter(locale, { granularity: 'sentence' }).segment(text),
      ({ segment }) => segment,
    )
  } catch {
    return fallbackSegments(text)
  }
}

export function segmentText(text: string, locale?: string): string[] {
  const normalized = text.replace(/\s+/gu, ' ').trim()
  if (!normalized) return []

  const protectedText = protectDots(normalized)
  const segments = segmentWithIntl(protectedText, locale)

  return segments
    .flatMap((segment) => splitLongSegment(restoreDots(segment).trim()))
    .filter(Boolean)
}
