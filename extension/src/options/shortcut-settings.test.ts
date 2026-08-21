import { describe, expect, it } from 'vitest'
import { shortcutSettingsUrl } from './shortcut-settings'

describe('shortcutSettingsUrl', () => {
  it('opens the native shortcut page for Chrome and Edge', () => {
    expect(shortcutSettingsUrl('Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36')).toBe(
      'chrome://extensions/shortcuts',
    )
    expect(
      shortcutSettingsUrl('Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0'),
    ).toBe('edge://extensions/shortcuts')
  })
})
