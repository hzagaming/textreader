// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { DocumentTextLocator, HighlightManager } from './highlight-manager'

describe('DocumentTextLocator', () => {
  it('locates a sentence across inline text nodes', () => {
    document.body.innerHTML =
      '<main><p>Hello <strong>multilingual</strong> world.</p></main>'
    const range = new DocumentTextLocator(document).find('Hello multilingual world.')
    expect(range?.toString()).toBe('Hello multilingual world.')
  })

  it('locates an explicit repeated-text occurrence without relying on cursor state', () => {
    document.body.innerHTML = `
      <main>
        <p>Repeated sentence.</p>
        <p>Repeated sentence.</p>
        <p>Repeated sentence.</p>
      </main>
    `
    const paragraphs = document.querySelectorAll('p')
    const locator = new DocumentTextLocator(document)

    const range = locator.find('Repeated sentence.', 2)

    expect(range?.startContainer.parentElement).toBe(paragraphs[2])
    expect(range?.toString()).toBe('Repeated sentence.')
  })

  it('limits repeated-text lookup to the active selection range', () => {
    document.body.innerHTML = `
      <main>
        <p>Repeated sentence.</p>
        <p>Repeated sentence.</p>
      </main>
    `
    const paragraphs = document.querySelectorAll('p')
    const selectionRange = document.createRange()
    selectionRange.selectNodeContents(paragraphs[1]!)

    const locator = new DocumentTextLocator(document)
    const scope = locator.createScope(selectionRange)
    const range = locator.find('Repeated sentence.', 0, scope)

    expect(range?.startContainer.parentElement).toBe(paragraphs[1])
  })
})

describe('HighlightManager', () => {
  it('uses a reversible DOM fallback without changing page text', () => {
    document.body.innerHTML = '<main><p>First sentence. Second sentence.</p></main>'
    const original = document.body.textContent
    const manager = new HighlightManager(document, false)

    expect(manager.show('Second sentence.')).toBe(true)
    expect(document.querySelectorAll('[data-textreader-highlight]')).toHaveLength(1)
    manager.clear()
    expect(document.querySelectorAll('[data-textreader-highlight]')).toHaveLength(0)
    expect(document.body.textContent).toBe(original)
    expect(manager.show('First sentence.')).toBe(true)
    manager.clear()
    expect(document.body.textContent).toBe(original)
  })

  it('keeps fallback highlighting on the requested occurrence after rebuilding', () => {
    document.body.innerHTML = `
      <main>
        <p>Repeated sentence.</p>
        <p>Repeated sentence.</p>
        <p>Repeated sentence.</p>
      </main>
    `
    const paragraphs = document.querySelectorAll('p')
    const manager = new HighlightManager(document, false)

    expect(manager.show('Repeated sentence.', 'sentence', 2)).toBe(true)
    expect(paragraphs[2]?.querySelector('[data-textreader-highlight]')).not.toBeNull()
    manager.clear()
    expect(manager.show('Repeated sentence.', 'sentence', 2)).toBe(true)
    expect(paragraphs[2]?.querySelector('[data-textreader-highlight]')).not.toBeNull()
  })

  it('keeps fallback highlighting inside the active selection range', () => {
    document.body.innerHTML = `
      <main>
        <p>Repeated sentence.</p>
        <p>Repeated sentence.</p>
      </main>
    `
    const paragraphs = document.querySelectorAll('p')
    const selectionRange = document.createRange()
    selectionRange.selectNodeContents(paragraphs[1]!)
    const manager = new HighlightManager(document, false)
    const scope = manager.createScope(selectionRange)

    expect(manager.show('Repeated sentence.', 'sentence', 0, scope)).toBe(true)
    expect(paragraphs[0]?.querySelector('[data-textreader-highlight]')).toBeNull()
    expect(paragraphs[1]?.querySelector('[data-textreader-highlight]')).not.toBeNull()
    manager.clear()
    expect(manager.show('Repeated sentence.', 'sentence', 0, scope)).toBe(true)
    expect(paragraphs[0]?.querySelector('[data-textreader-highlight]')).toBeNull()
    expect(paragraphs[1]?.querySelector('[data-textreader-highlight]')).not.toBeNull()
  })
})
