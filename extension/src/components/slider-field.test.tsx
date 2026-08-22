// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SliderField } from './slider-field'

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(() => {
  document.body.replaceChildren()
  vi.clearAllMocks()
})

describe('SliderField', () => {
  it('updates its visible value while dragging and commits only on release', async () => {
    const onChange = vi.fn().mockResolvedValue(true)
    const root = createRoot(document.body.appendChild(document.createElement('div')))

    act(() =>
      root.render(
        <SliderField
          label="Speed"
          value={1}
          minimum={0.5}
          maximum={2.5}
          step={0.05}
          formatValue={(value) => `${value.toFixed(2)}×`}
          onChange={onChange}
        />,
      ),
    )
    const input = document.querySelector('input[type="range"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing range input')

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        input,
        '1.25',
      )
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        input,
        '1.4',
      )
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    })

    expect(onChange).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('1.40×')

    await act(async () => {
      input.dispatchEvent(new Event('pointerup', { bubbles: true }))
      await Promise.resolve()
    })

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith(1.4)
    act(() => root.unmount())
  })

  it('returns to the persisted value when saving fails', async () => {
    const onChange = vi.fn().mockResolvedValue(false)
    const root = createRoot(document.body.appendChild(document.createElement('div')))

    act(() =>
      root.render(
        <SliderField
          label="Volume"
          value={1}
          minimum={0}
          maximum={1}
          step={0.01}
          formatValue={(value) => `${Math.round(value * 100)}%`}
          onChange={onChange}
        />,
      ),
    )
    const input = document.querySelector('input[type="range"]')
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing range input')

    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
        input,
        '0.4',
      )
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    })
    await act(async () => {
      input.dispatchEvent(new Event('pointerup', { bubbles: true }))
      await Promise.resolve()
    })

    expect(document.body.textContent).toContain('100%')
    expect(input.value).toBe('1')
    act(() => root.unmount())
  })
})
