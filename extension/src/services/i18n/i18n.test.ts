import { describe, expect, it } from 'vitest'
import { createTranslator, resolveUiLanguage, translateErrorCode } from './i18n'

describe('application translations', () => {
  it('resolves explicit and browser-derived UI languages', () => {
    expect(resolveUiLanguage('ja', 'en-US')).toBe('ja')
    expect(resolveUiLanguage('auto', 'zh-TW')).toBe('zh')
    expect(resolveUiLanguage('auto', 'fr-FR')).toBe('en')
  })

  it('translates core controls and substitutions', () => {
    const en = createTranslator('en', 'zh-CN')
    const zh = createTranslator('zh', 'en-US')
    const ja = createTranslator('ja', 'en-US')

    expect(zh('settingsTitle')).toBe('设置')
    expect(ja('readPage')).toBe('ページを読む')
    expect(zh('continueAt', ['42'])).toBe('从 42% 继续？')
    expect(en('localVoicePrivacy')).toContain(
      'may send spoken text through its own service',
    )
  })

  it('maps reader error codes to localized, user-safe messages', () => {
    const zh = createTranslator('zh', 'en-US')

    expect(translateErrorCode('EMPTY_TEXT', zh)).toBe('没有找到可朗读的文字。')
    expect(translateErrorCode('UNSUPPORTED_PAGE', zh)).toBe(
      'TextReader 无法在此页面使用。',
    )
    expect(translateErrorCode('TTS_ERROR', zh)).toBe('系统音色无法播放这段文字。')
    expect(translateErrorCode('UNRECOGNIZED', zh)).toBe('TextReader 遇到了意外错误。')
  })
})
