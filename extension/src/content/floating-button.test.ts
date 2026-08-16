// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { SelectionFloatingButton } from './floating-button'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
  document.documentElement
    .querySelectorAll('[data-textreader-root]')
    .forEach((node) => node.remove())
})

describe('SelectionFloatingButton', () => {
  it('keeps the large-selection menu inside a narrow viewport', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(200)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(320)
    const button = new SelectionFloatingButton(vi.fn(), vi.fn())

    button.show({
      text: 'Selected text',
      pageUrl: 'https://example.com',
      pageTitle: 'Example',
      rect: { x: 12, y: 80, width: 170, height: 180 },
      timestamp: 1,
      isLargeSelection: true,
    })

    const host = document.documentElement.querySelector<HTMLElement>(
      '[data-textreader-root="selection-button"]',
    )
    expect(Number.parseFloat(host?.style.left ?? '')).toBeGreaterThanOrEqual(8)
    expect(Number.parseFloat(host?.style.top ?? '')).toBeGreaterThanOrEqual(8)
    button.destroy()
  })
})
