import { Readability } from '@mozilla/readability'
import type { ReaderDocument } from '@textreader/shared'
import { createReaderDocument } from '@/services/reader/document-factory'
import { TextReaderError } from '@/types/errors'

export type ExtractionMode = 'article' | 'page'

const REMOVE_SELECTORS = [
  'nav',
  'footer',
  'header:not(article header)',
  'aside',
  'script',
  'style',
  'noscript',
  'template',
  'button',
  'form',
  '[aria-hidden="true"]',
  '[hidden]',
  '[data-nosnippet]',
  '[class*="advert"]',
  '[class*="ad-container"]',
  '[class*="editsection"]',
  '[class*="social-share"]',
  '[class*="share-buttons"]',
  '[id*="advert"]',
].join(',')

const PARAGRAPH_SELECTORS = 'p, li, blockquote, pre, h2, h3, h4'

function normalizeText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/gu, ' ').trim()
}

function removeNoise(document: Document): Document {
  document.querySelectorAll(REMOVE_SELECTORS).forEach((element) => element.remove())
  return document
}

function headingText(element: Element | null): string {
  if (!element) return ''
  const clone = element.cloneNode(true) as Element
  clone.querySelectorAll(REMOVE_SELECTORS).forEach((node) => node.remove())
  return normalizeText(clone.textContent)
}

function paragraphsFromElement(element: Element): string[] {
  const paragraphs = Array.from(element.querySelectorAll(PARAGRAPH_SELECTORS))
    .map((node) => normalizeText(node.textContent))
    .filter((text) => text.length >= 2)

  if (paragraphs.length > 0) return paragraphs
  const rawText = element instanceof HTMLElement ? element.innerText : element.textContent
  return (rawText ?? '')
    .split(/\n+/u)
    .map(normalizeText)
    .filter((text) => text.length >= 2)
}

function paragraphsFromHtml(document: Document, html: string): string[] {
  const container = document.createElement('article')
  container.innerHTML = html
  container.querySelectorAll(REMOVE_SELECTORS).forEach((element) => element.remove())
  return paragraphsFromElement(container)
}

function largestTextContainer(document: Document): Element | undefined {
  const candidates = Array.from(document.querySelectorAll('article, main, section, div'))
  return candidates
    .map((element) => {
      const textLength = normalizeText(element.textContent).length
      const linkLength = Array.from(element.querySelectorAll('a')).reduce(
        (total, link) => total + normalizeText(link.textContent).length,
        0,
      )
      const linkDensity = textLength > 0 ? linkLength / textLength : 1
      const paragraphCount = element.querySelectorAll('p').length
      return { element, score: textLength * (1 - linkDensity) + paragraphCount * 80 }
    })
    .filter(({ score }) => score >= 80)
    .sort((left, right) => right.score - left.score)[0]?.element
}

function metadata(document: Document) {
  const byline = normalizeText(
    document.querySelector<HTMLMetaElement>('meta[name="author"]')?.content,
  )
  const siteName = normalizeText(
    document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content,
  )
  const language = normalizeText(document.documentElement.lang)
  return { byline, siteName, language }
}

export class ArticleExtractor {
  constructor(
    private readonly source: Document,
    private readonly url: string,
  ) {}

  extract(mode: ExtractionMode): ReaderDocument {
    return mode === 'page' ? this.extractPage() : this.extractArticle()
  }

  private extractArticle(): ReaderDocument {
    const readableClone = removeNoise(this.source.cloneNode(true) as Document)
    const article: ReturnType<Readability['parse']> = (() => {
      try {
        return new Readability(readableClone, {
          charThreshold: 140,
          keepClasses: false,
        }).parse()
      } catch {
        return null
      }
    })()

    if (article) {
      const readabilityParagraphs = paragraphsFromHtml(this.source, article.content ?? '')
      const sourceHeader = this.source.querySelector('article header')
      const leadParagraphs = sourceHeader ? paragraphsFromElement(sourceHeader) : []
      const paragraphs = [
        ...leadParagraphs.filter(
          (paragraph) => !readabilityParagraphs.includes(paragraph),
        ),
        ...readabilityParagraphs,
      ]
      if (paragraphs.join(' ').length >= 40) {
        const sourceMetadata = metadata(this.source)
        const sourceHeading = headingText(
          this.source.querySelector('article h1, main h1, h1'),
        )
        return createReaderDocument({
          url: this.url,
          title: sourceHeading || article.title || this.source.title,
          paragraphs,
          ...(article.byline || sourceMetadata.byline
            ? { byline: article.byline || sourceMetadata.byline }
            : {}),
          ...(article.siteName || sourceMetadata.siteName
            ? { siteName: article.siteName || sourceMetadata.siteName }
            : {}),
          ...(article.lang || sourceMetadata.language
            ? { language: article.lang || sourceMetadata.language }
            : {}),
        })
      }
    }

    const fallbackClone = removeNoise(this.source.cloneNode(true) as Document)
    const container =
      fallbackClone.querySelector('article') ??
      fallbackClone.querySelector('main') ??
      largestTextContainer(fallbackClone) ??
      fallbackClone.body
    return this.createFallbackDocument(fallbackClone, container)
  }

  private extractPage(): ReaderDocument {
    const clone = removeNoise(this.source.cloneNode(true) as Document)
    return this.createFallbackDocument(clone, clone.body)
  }

  private createFallbackDocument(
    document: Document,
    container: Element | null,
  ): ReaderDocument {
    if (!container) {
      throw new TextReaderError('UNSUPPORTED_PAGE', 'This page has no readable content.')
    }
    const paragraphs = paragraphsFromElement(container)
    if (paragraphs.length === 0) {
      throw new TextReaderError('EMPTY_TEXT', 'No readable page text was found.')
    }
    const pageMetadata = metadata(document)
    const heading = headingText(container.querySelector('h1'))
    return createReaderDocument({
      url: this.url,
      title: heading || normalizeText(document.title) || 'Untitled page',
      paragraphs,
      ...(pageMetadata.byline ? { byline: pageMetadata.byline } : {}),
      ...(pageMetadata.siteName ? { siteName: pageMetadata.siteName } : {}),
      ...(pageMetadata.language ? { language: pageMetadata.language } : {}),
    })
  }
}
