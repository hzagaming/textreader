export const TEXT_READER_ERROR_CODES = [
  'NO_SELECTION',
  'EMPTY_TEXT',
  'TTS_ERROR',
  'UNSUPPORTED_PAGE',
  'PERMISSION_ERROR',
  'UNKNOWN',
] as const

export type TextReaderErrorCode = (typeof TEXT_READER_ERROR_CODES)[number]

export class TextReaderError extends Error {
  constructor(
    public readonly code: TextReaderErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'TextReaderError'
  }
}

export function asTextReaderError(error: unknown): TextReaderError {
  if (error instanceof TextReaderError) return error
  if (error instanceof Error) {
    return new TextReaderError('UNKNOWN', error.message, { cause: error })
  }
  return new TextReaderError('UNKNOWN', 'An unexpected error occurred')
}
