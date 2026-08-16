import type { HighlightMode } from '@textreader/shared'

const HIGHLIGHT_NAME = 'textreader-current'
const IGNORED_SELECTOR =
  'script, style, noscript, textarea, input, select, [data-textreader-root], [aria-hidden="true"]'
const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'ARTICLE',
  'MAIN',
  'SECTION',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'H1',
  'H2',
  'H3',
  'H4',
])

interface TextPosition {
  node: Text
  offset: number
}

export interface DocumentTextScope {
  start: number
  end: number
}

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, ' ').trim()
}

function textNodes(root: Node, document: Document): Text[] {
  if (root instanceof Text) return [root]
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    if (
      current instanceof Text &&
      current.data.trim() &&
      !current.parentElement?.closest(IGNORED_SELECTOR)
    ) {
      nodes.push(current)
    }
    current = walker.nextNode()
  }
  return nodes
}

export class DocumentTextLocator {
  private text = ''
  private positions: TextPosition[] = []

  constructor(private readonly document: Document) {
    this.rebuild()
  }

  rebuild(): void {
    this.text = ''
    this.positions = []
    const root = this.document.body ?? this.document.documentElement
    if (!root) return

    for (const node of textNodes(root, this.document)) {
      for (let offset = 0; offset < node.data.length; offset += 1) {
        const character = node.data[offset] ?? ''
        if (/\s/u.test(character)) {
          if (this.text && !this.text.endsWith(' ')) {
            this.text += ' '
            this.positions.push({ node, offset })
          }
        } else {
          this.text += character
          this.positions.push({ node, offset })
        }
      }

      if (
        BLOCK_TAGS.has(node.parentElement?.tagName ?? '') &&
        this.text &&
        !this.text.endsWith(' ')
      ) {
        this.text += ' '
        this.positions.push({ node, offset: node.data.length })
      }
    }
  }

  createScope(range: Range): DocumentTextScope | undefined {
    let start = -1
    let end = -1
    for (let index = 0; index < this.positions.length; index += 1) {
      const position = this.positions[index]
      if (
        position &&
        range.isPointInRange(
          position.node,
          Math.min(position.offset, position.node.length),
        )
      ) {
        if (start < 0) start = index
        end = index + 1
      }
    }
    return start >= 0 && end > start ? { start, end } : undefined
  }

  find(query: string, occurrence = 0, within?: DocumentTextScope): Range | undefined {
    const normalized = normalizeText(query)
    if (!normalized) return undefined
    const targetOccurrence = Number.isFinite(occurrence)
      ? Math.max(0, Math.trunc(occurrence))
      : 0
    let fromIndex = 0
    let currentOccurrence = 0
    while (fromIndex <= this.text.length - normalized.length) {
      const index = this.text.indexOf(normalized, fromIndex)
      if (index < 0) return undefined
      fromIndex = index + normalized.length

      const start = this.positions[index]
      const end = this.positions[index + normalized.length - 1]
      if (!start || !end) return undefined
      if (within && (index < within.start || fromIndex > within.end)) continue

      const range = this.document.createRange()
      range.setStart(start.node, Math.min(start.offset, start.node.length))
      range.setEnd(end.node, Math.min(end.offset + 1, end.node.length))
      if (currentOccurrence === targetOccurrence) return range
      currentOccurrence += 1
    }
    return undefined
  }
}

export class HighlightManager {
  private readonly locator: DocumentTextLocator
  private fallbackSpans: HTMLSpanElement[] = []
  private readonly useCustomHighlight: boolean
  private style: HTMLStyleElement | undefined

  constructor(
    private readonly document: Document,
    preferCustomHighlight = true,
  ) {
    this.locator = new DocumentTextLocator(document)
    this.useCustomHighlight =
      preferCustomHighlight && typeof Highlight === 'function' && 'highlights' in CSS
  }

  show(
    text: string,
    mode: HighlightMode = 'sentence',
    occurrence = 0,
    within?: DocumentTextScope,
  ): boolean {
    this.clear()
    if (mode === 'off') return false
    const range = this.locator.find(text, occurrence, within)
    if (!range) return false

    if (this.useCustomHighlight) {
      this.ensureStyle()
      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range))
    } else {
      this.wrapRange(range)
    }
    return true
  }

  createScope(range: Range): DocumentTextScope | undefined {
    return this.locator.createScope(range)
  }

  clear(): void {
    if ('highlights' in CSS) CSS.highlights.delete(HIGHLIGHT_NAME)
    const hadFallback = this.fallbackSpans.length > 0
    for (const span of this.fallbackSpans) {
      span.replaceWith(...span.childNodes)
    }
    this.fallbackSpans = []
    if (hadFallback) this.locator.rebuild()
  }

  destroy(): void {
    this.clear()
    this.style?.remove()
  }

  rebuild(): void {
    this.clear()
    this.locator.rebuild()
  }

  private ensureStyle(): void {
    if (this.style) return
    this.style = this.document.createElement('style')
    this.style.dataset.textreaderRoot = 'highlight-style'
    this.style.textContent = `::highlight(${HIGHLIGHT_NAME}) { background-color: rgba(250, 204, 21, .34); color: inherit; }`
    this.document.head.append(this.style)
  }

  private wrapRange(range: Range): void {
    const nodes = textNodes(range.commonAncestorContainer, this.document).filter((node) =>
      range.intersectsNode(node),
    )

    for (const node of nodes.reverse()) {
      const start = node === range.startContainer ? range.startOffset : 0
      const end = node === range.endContainer ? range.endOffset : node.length
      if (start >= end) continue

      const part = this.document.createRange()
      part.setStart(node, start)
      part.setEnd(node, end)
      const span = this.document.createElement('span')
      span.dataset.textreaderHighlight = 'current'
      span.style.cssText =
        'background:rgba(250,204,21,.34)!important;color:inherit!important;border-radius:2px!important;'
      part.surroundContents(span)
      this.fallbackSpans.push(span)
    }
  }
}
