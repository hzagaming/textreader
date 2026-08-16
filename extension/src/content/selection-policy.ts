const MEANINGFUL_CHARACTER =
  /[\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u

export function isMeaningfulSelectionText(text: string): boolean {
  const normalized = text.replace(/\s+/gu, ' ').trim()
  return normalized.length >= 2 && MEANINGFUL_CHARACTER.test(normalized)
}

export function shouldIgnoreSelectionTarget(target: Node | null): boolean {
  const element = target instanceof Element ? target : target?.parentElement
  if (!element) return false

  return Boolean(
    element.closest(
      'input[type="password"], [data-textreader-root], [data-textreader-ignore]',
    ),
  )
}
