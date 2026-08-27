import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from './settings'
import { SettingsUpdateQueue, type SettingsPatch } from './settings-update-queue'

describe('SettingsUpdateQueue', () => {
  it('continues processing updates after a failed write', async () => {
    const persist = vi
      .fn()
      .mockRejectedValueOnce(new Error('storage failed'))
      .mockImplementationOnce((patch: SettingsPatch) =>
        Promise.resolve({ ...DEFAULT_SETTINGS, ...patch }),
      )
    const queue = new SettingsUpdateQueue(DEFAULT_SETTINGS, persist)

    const failed = queue.update({ speed: 1.25 })
    const recovered = queue.update((settings) => ({ pitch: settings.pitch + 0.1 }))

    await expect(failed).rejects.toThrow('storage failed')
    await expect(recovered).resolves.toMatchObject({ pitch: 0.1 })
    expect(persist).toHaveBeenNthCalledWith(2, { pitch: 0.1 })
  })
})
