import { describe, expect, it } from 'vitest'
import {
  detectTextLanguage,
  normalizeSupportedLanguage,
  resolveReadingLanguage,
} from './language'

describe('language detection', () => {
  it('detects English, Chinese, Japanese, and Korean scripts', () => {
    expect(detectTextLanguage('Read this article aloud.')).toBe('en')
    expect(detectTextLanguage('请为我朗读这篇文章。')).toBe('zh')
    expect(detectTextLanguage('この記事を読み上げてください。')).toBe('ja')
    expect(detectTextLanguage('이 문서를 읽어 주세요.')).toBe('ko')
  })

  it('normalizes browser language tags and uses hints for neutral text', () => {
    expect(normalizeSupportedLanguage('zh-Hans-CN')).toBe('zh')
    expect(normalizeSupportedLanguage('ja-JP')).toBe('ja')
    expect(detectTextLanguage('2026 — 42%', 'ko-KR')).toBe('ko')
  })

  it('uses the document hint to disambiguate Han-only Japanese and Korean text', () => {
    expect(detectTextLanguage('東京都', 'ja-JP')).toBe('ja')
    expect(detectTextLanguage('漢字', 'ko-KR')).toBe('ko')
    expect(detectTextLanguage('北京市', 'en-US')).toBe('zh')
  })

  it('honors a fixed reading language over automatic detection', () => {
    expect(resolveReadingLanguage('English sentence.', 'zh', 'en-US')).toBe('zh')
    expect(resolveReadingLanguage('日本語です。', 'auto', 'en-US')).toBe('ja')
  })
})
