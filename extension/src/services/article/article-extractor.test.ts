// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { ArticleExtractor } from './article-extractor'

function page(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('ArticleExtractor', () => {
  it('extracts article metadata and ignores navigation noise', () => {
    const repeated =
      'Readable article content with enough detail for the extraction engine. '.repeat(10)
    const document = page(
      `<!doctype html><html><head><title>Fallback title</title><meta property="og:site_name" content="Example News"></head><body><nav>Home Pricing Login</nav><article><h1>Useful story</h1><p>${repeated}</p><p>Second paragraph completes the story.</p></article><footer>Copyright links</footer></body></html>`,
    )
    const result = new ArticleExtractor(document, 'https://example.com/story').extract(
      'article',
    )

    expect(result.title).toBe('Useful story')
    expect(result.siteName).toBe('Example News')
    expect(result.plainText).toContain('Readable article content')
    expect(result.plainText).not.toContain('Home Pricing Login')
  })

  it('prefers the cleaned Readability title over nested heading controls', () => {
    const repeated =
      'Long-form article content gives Readability enough text to parse safely. '.repeat(
        10,
      )
    const document = page(
      `<!doctype html><html><head><title>Useful story</title></head><body><article><h1>Useful story <span data-nosnippet>Stay organized with collections</span><span class="mw-editsection">[edit]</span><button>Save and categorize</button></h1><p>${repeated}</p></article></body></html>`,
    )

    const result = new ArticleExtractor(
      document,
      'https://example.com/noisy-heading',
    ).extract('article')

    expect(result.title).toBe('Useful story')
  })

  it('falls back to main content when Readability has too little text', () => {
    const document = page(
      '<html><head><title>Docs</title></head><body><nav>Menu</nav><main><p>Install the package.</p><p>Run the build command.</p></main></body></html>',
    )
    const result = new ArticleExtractor(document, 'https://example.com/docs').extract(
      'article',
    )

    expect(result.title).toBe('Docs')
    expect(result.paragraphs.map((paragraph) => paragraph.text)).toEqual([
      'Install the package.',
      'Run the build command.',
    ])
  })

  it('page mode collects body text while filtering controls', () => {
    const document = page(
      '<html><head><title>Page</title></head><body><header>Site header</header><section><p>Primary text.</p></section><button>Buy now</button><section><p>Secondary text.</p></section></body></html>',
    )
    const result = new ArticleExtractor(document, 'https://example.com/page').extract(
      'page',
    )
    expect(result.plainText).toContain('Primary text.')
    expect(result.plainText).toContain('Secondary text.')
    expect(result.plainText).not.toContain('Buy now')
  })

  it('preserves legitimate non-adjacent repeated paragraphs', () => {
    const document = page(
      '<html><head><title>Repeated refrain</title></head><body><main><p>Read this refrain again.</p><p>A different paragraph separates it.</p><p>Read this refrain again.</p></main></body></html>',
    )

    const result = new ArticleExtractor(document, 'https://example.com/repeated').extract(
      'page',
    )

    expect(result.paragraphs.map((paragraph) => paragraph.text)).toEqual([
      'Read this refrain again.',
      'A different paragraph separates it.',
      'Read this refrain again.',
    ])
  })

  it('keeps an article introduction inside its header while removing the site header', () => {
    const body =
      'The body contains enough detailed reporting for reliable article extraction. '.repeat(
        10,
      )
    const document = page(
      `<!doctype html><html><head><title>Report</title></head><body><header><nav>Site navigation</nav></header><article><header><h1>Report</h1><p>Important article introduction.</p></header><p>${body}</p></article></body></html>`,
    )

    const result = new ArticleExtractor(
      document,
      'https://example.com/article-header',
    ).extract('article')

    expect(result.plainText).toContain('Important article introduction.')
    expect(result.plainText).not.toContain('Site navigation')
  })

  it('reads nested list labels once without merging child text into the parent', () => {
    const document = page(
      '<html><head><title>Nested list</title></head><body><main><ul><li>Parent item<ul><li>Child item</li></ul></li><li>Sibling item</li></ul></main></body></html>',
    )

    const result = new ArticleExtractor(
      document,
      'https://example.com/nested-list',
    ).extract('page')

    expect(result.paragraphs.map((paragraph) => paragraph.text)).toEqual([
      'Parent item',
      'Child item',
      'Sibling item',
    ])
  })
})
