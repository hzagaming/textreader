import type { TextSelection, UiLanguage } from '@textreader/shared'
import { createTranslator, resolveUiLanguage } from '@/services/i18n/i18n'
import { DEFAULT_SETTINGS } from '@/services/settings/settings'

const BUTTON_SIZE = 38
const LARGE_HEIGHT = 46
const LARGE_WIDTH = 224
const GAP = 10
const EDGE = 8

export class SelectionFloatingButton {
  private readonly host = document.createElement('div')
  private readonly singleButton: HTMLButtonElement
  private readonly selectionButton: HTMLButtonElement
  private readonly articleButton: HTMLButtonElement
  private readonly choices: HTMLDivElement
  private readonly singleWrap: HTMLDivElement
  private readonly tip: HTMLSpanElement
  private selection: TextSelection | null = null
  private t = createTranslator(DEFAULT_SETTINGS.uiLanguage)

  constructor(
    private readonly onRead: (selection: TextSelection) => void,
    private readonly onReadArticle: () => void,
  ) {
    this.host.dataset.textreaderRoot = 'selection-button'
    this.host.lang = resolveUiLanguage(DEFAULT_SETTINGS.uiLanguage)
    this.host.hidden = true
    const shadow = this.host.attachShadow({ mode: 'closed' })
    const style = document.createElement('style')
    style.textContent = `
      :host { all: initial; color-scheme: light dark; }
      :host([hidden]) { display: none !important; }
      [hidden] { display: none !important; }
      .single-wrap { position: relative; }
      button {
        align-items: center; background: rgba(20, 24, 31, .96); border: 1px solid rgba(255,255,255,.18);
        border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.22); color: #fff; cursor: pointer;
        display: flex; font: 600 12px/1 ui-sans-serif, system-ui, sans-serif; height: ${BUTTON_SIZE}px;
        justify-content: center; padding: 0 13px; transition: transform 150ms ease, background 150ms ease;
      }
      button:hover { background: rgba(34, 40, 51, .99); transform: translateY(-1px); }
      button:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 2px; }
      .single { padding: 0; width: ${BUTTON_SIZE}px; }
      svg { height: 18px; width: 18px; }
      .tip {
        background: rgba(20, 24, 31, .96); border-radius: 7px; bottom: calc(100% + 7px); color: white;
        font: 500 12px/1.2 ui-sans-serif, system-ui, sans-serif; left: 50%; opacity: 0; padding: 6px 8px;
        max-width: calc(100vw - ${EDGE * 2}px); pointer-events: none; position: absolute;
        transform: translate(calc(-50% + var(--tip-shift, 0px)), 3px); transition: 150ms ease;
        white-space: normal; width: max-content;
      }
      .single:hover + .tip, .single:focus-visible + .tip {
        opacity: 1; transform: translate(calc(-50% + var(--tip-shift, 0px)), 0);
      }
      .choices { box-sizing: border-box; display: flex; gap: 6px; max-width: calc(100vw - ${EDGE * 2}px); width: ${LARGE_WIDTH}px;
        padding: 5px; background: rgba(20,24,31,.96); border-radius: 14px;
        border: 1px solid rgba(255,255,255,.18); box-shadow: 0 8px 28px rgba(0,0,0,.24); }
      .choices button { box-shadow: none; flex: 1; height: 34px; min-width: 0; white-space: nowrap; }
      .choices button + button { background: rgba(255,255,255,.11); }
      @keyframes appear { from { opacity: .5; transform: translateY(2px) scale(.97); } }
      .single-wrap:not([hidden]), .choices:not([hidden]) { animation: appear 150ms cubic-bezier(.22,1,.36,1) both; }
      @media (prefers-reduced-motion: reduce) { button, .tip { transition: none; } .single-wrap, .choices { animation: none; } }
    `

    this.singleWrap = document.createElement('div')
    this.singleWrap.className = 'single-wrap'
    this.singleButton = this.createButton(this.t('readWithTextReader'), 'single')
    this.singleButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 9v6h4l5 4V5L9 9H5Z" fill="currentColor"/>
        <path d="M17 8.2a5 5 0 0 1 0 7.6M19.5 5.8a8.2 8.2 0 0 1 0 12.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
      </svg>`
    this.tip = document.createElement('span')
    this.tip.className = 'tip'
    this.tip.textContent = this.t('readWithTextReader')
    this.singleWrap.append(this.singleButton, this.tip)

    this.choices = document.createElement('div')
    this.choices.className = 'choices'
    this.selectionButton = this.createButton(this.t('readSelection'))
    this.articleButton = this.createButton(this.t('readArticle'))
    this.choices.append(this.selectionButton, this.articleButton)

    this.singleButton.addEventListener('click', this.handleSelectionClick)
    this.selectionButton.addEventListener('click', this.handleSelectionClick)
    this.articleButton.addEventListener('click', this.handleArticleClick)
    shadow.append(style, this.singleWrap, this.choices)
    document.documentElement.append(this.host)
  }

  show(selection: TextSelection): void {
    this.selection = selection
    this.singleWrap.hidden = selection.isLargeSelection
    this.choices.hidden = !selection.isLargeSelection
    const availableWidth = Math.max(BUTTON_SIZE, window.innerWidth - EDGE * 2)
    const width = selection.isLargeSelection
      ? Math.min(LARGE_WIDTH, availableWidth)
      : BUTTON_SIZE
    const height = selection.isLargeSelection ? LARGE_HEIGHT : BUTTON_SIZE
    const above = selection.rect.y - height - GAP
    const top = above >= EDGE ? above : selection.rect.y + selection.rect.height + GAP
    const left = Math.min(
      Math.max(EDGE, window.innerWidth - width - EDGE),
      Math.max(EDGE, selection.rect.x + selection.rect.width - width),
    )
    const maxTop = Math.max(EDGE, window.innerHeight - height - EDGE)

    Object.assign(this.host.style, {
      display: 'block',
      position: 'fixed',
      left: `${left}px`,
      top: `${Math.max(EDGE, Math.min(maxTop, top))}px`,
      zIndex: '2147483647',
    })
    this.host.hidden = false
    const tipRect = this.tip.getBoundingClientRect()
    const shift =
      tipRect.left < EDGE
        ? EDGE - tipRect.left
        : tipRect.right > window.innerWidth - EDGE
          ? window.innerWidth - EDGE - tipRect.right
          : 0
    this.tip.style.setProperty('--tip-shift', `${shift}px`)
  }

  setLanguage(language: UiLanguage): void {
    this.t = createTranslator(language)
    this.host.lang = resolveUiLanguage(language)
    const readWithTextReader = this.t('readWithTextReader')
    this.singleButton.ariaLabel = readWithTextReader
    this.tip.textContent = readWithTextReader
    this.selectionButton.textContent = this.t('readSelection')
    this.selectionButton.ariaLabel = this.t('readSelection')
    this.articleButton.textContent = this.t('readArticle')
    this.articleButton.ariaLabel = this.t('readArticle')
  }

  hide(): void {
    this.host.hidden = true
    this.host.style.display = 'none'
  }

  destroy(): void {
    this.singleButton.removeEventListener('click', this.handleSelectionClick)
    this.selectionButton.removeEventListener('click', this.handleSelectionClick)
    this.articleButton.removeEventListener('click', this.handleArticleClick)
    this.host.remove()
  }

  private createButton(label: string, className = ''): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = className
    button.ariaLabel = label
    button.textContent = label
    button.addEventListener('pointerdown', (event) => event.stopPropagation())
    return button
  }

  private readonly handleSelectionClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (this.selection) this.onRead(this.selection)
    this.hide()
  }

  private readonly handleArticleClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    this.onReadArticle()
    this.hide()
  }
}
