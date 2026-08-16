import type { ReaderStatus } from '@textreader/shared'

export function shouldIgnoreReaderKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'input, textarea, select, button, summary, a[href], audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="menuitem"], [role="slider"], [role="spinbutton"], [role="switch"], [role="tab"], [role="textbox"]',
    ),
  )
}

export function shouldHandleReaderKeyboard(
  status: ReaderStatus,
  hasDocument: boolean,
): boolean {
  return hasDocument && (status === 'playing' || status === 'paused')
}
