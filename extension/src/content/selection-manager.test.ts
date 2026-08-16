// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { SelectionManager } from './selection-manager'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('SelectionManager', () => {
  it('retains a clone of the selected DOM range', () => {
    vi.useFakeTimers()
    document.body.innerHTML = `
      <main>
        <p>Repeated sentence.</p>
        <p>Repeated sentence.</p>
      </main>
    `
    const paragraph = document.querySelectorAll('p')[1]!
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    vi.spyOn(range, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 30, 160, 24))
    vi.spyOn(window, 'getSelection').mockReturnValue({
      anchorNode: paragraph.firstChild,
      getRangeAt: () => range,
      isCollapsed: false,
      rangeCount: 1,
      toString: () => 'Repeated sentence.',
    } as unknown as Selection)
    const onSelection = vi.fn()
    const manager = new SelectionManager(onSelection)
    manager.start()

    paragraph.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    vi.runAllTimers()

    expect(manager.getCurrentRange()?.toString()).toBe('Repeated sentence.')
    expect(manager.getCurrentRange()).not.toBe(range)
    manager.stop()
  })
})
