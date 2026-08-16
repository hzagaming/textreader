// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import {
  shouldHandleReaderKeyboard,
  shouldIgnoreReaderKeyboardTarget,
} from './reader-keyboard'

describe('reader keyboard policy', () => {
  it('only captures playback keys while a document is actively playing or paused', () => {
    expect(shouldHandleReaderKeyboard('playing', true)).toBe(true)
    expect(shouldHandleReaderKeyboard('paused', true)).toBe(true)
    expect(shouldHandleReaderKeyboard('stopped', true)).toBe(false)
    expect(shouldHandleReaderKeyboard('error', true)).toBe(false)
    expect(shouldHandleReaderKeyboard('playing', false)).toBe(false)
  })

  it('ignores native and custom editable regions', () => {
    const input = document.createElement('input')
    const editor = document.createElement('div')
    editor.setAttribute('contenteditable', '')
    const nested = document.createElement('span')
    editor.append(nested)
    const textbox = document.createElement('div')
    textbox.setAttribute('role', 'textbox')

    const link = document.createElement('a')
    link.href = '#target'

    expect(shouldIgnoreReaderKeyboardTarget(input)).toBe(true)
    expect(shouldIgnoreReaderKeyboardTarget(nested)).toBe(true)
    expect(shouldIgnoreReaderKeyboardTarget(textbox)).toBe(true)
    expect(shouldIgnoreReaderKeyboardTarget(document.createElement('button'))).toBe(true)
    expect(shouldIgnoreReaderKeyboardTarget(link)).toBe(true)
    expect(shouldIgnoreReaderKeyboardTarget(document.createElement('p'))).toBe(false)
  })
})
