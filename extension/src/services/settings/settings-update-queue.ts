import type { ReaderSettings } from '@textreader/shared'

export type SettingsPatch = Partial<Omit<ReaderSettings, 'schemaVersion'>>
export type SettingsUpdate = SettingsPatch | ((settings: ReaderSettings) => SettingsPatch)

type PersistSettings = (patch: SettingsPatch) => Promise<ReaderSettings>

export class SettingsUpdateQueue {
  private tail: Promise<void> = Promise.resolve()

  constructor(
    private latest: ReaderSettings,
    private readonly persist: PersistSettings,
  ) {}

  sync(settings: ReaderSettings): void {
    this.latest = settings
  }

  update(update: SettingsUpdate): Promise<ReaderSettings> {
    const operation = this.tail.then(async () => {
      const patch = typeof update === 'function' ? update(this.latest) : update
      const settings = await this.persist(patch)
      this.latest = settings
      return settings
    })
    this.tail = operation.then(
      () => undefined,
      () => undefined,
    )
    return operation
  }
}
