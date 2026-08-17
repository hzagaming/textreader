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

  it('clears a selection whose range is no longer visible', () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<p>Invisible selected text.</p>'
    const paragraph = document.querySelector('p')!
    const range = document.createRange()
    range.selectNodeContents(paragraph)
    vi.spyOn(range, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 0, 0))
    vi.spyOn(window, 'getSelection').mockReturnValue({
      anchorNode: paragraph.firstChild,
      getRangeAt: () => range,
      isCollapsed: false,
      rangeCount: 1,
      toString: () => 'Invisible selected text.',
    } as unknown as Selection)
    const onSelection = vi.fn()
    const manager = new SelectionManager(onSelection)
    manager.start()

    paragraph.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    vi.runAllTimers()

    expect(onSelection).toHaveBeenLastCalledWith(null)
    expect(manager.getCurrent()).toBeNull()
    manager.stop()
  })

  it('hides the existing control when clicking an ignored password field', () => {
    const onSelection = vi.fn()
    const manager = new SelectionManager(onSelection)
    const password = document.createElement('input')
    password.type = 'password'
    document.body.append(password)
    manager.start()

    password.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    expect(onSelection).toHaveBeenCalledWith(null)
    manager.stop()
  })

  it('keeps the floating control visible while it is being clicked', () => {
    const onSelection = vi.fn()
    const manager = new SelectionManager(onSelection)
    const control = document.createElement('div')
    control.dataset.textreaderRoot = 'selection-button'
    document.body.append(control)
    manager.start()

    control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))

    expect(onSelection).not.toHaveBeenCalled()
    manager.stop()
  })
})
