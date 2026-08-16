import type { TextSelection } from '@textreader/shared'
import {
  isMeaningfulSelectionText,
  shouldIgnoreSelectionTarget,
} from './selection-policy'

type SelectionListener = (selection: TextSelection | null) => void

export class SelectionManager {
  private selection: TextSelection | null = null
  private range: Range | null = null
  private updateTimer: number | undefined
  private started = false

  constructor(private readonly onSelection: SelectionListener) {}

  start(): void {
    if (this.started) return
    this.started = true
    document.addEventListener('mouseup', this.handleMouseUp, true)
    document.addEventListener('selectionchange', this.handleSelectionChange)
    document.addEventListener('keyup', this.handleKeyUp, true)
    document.addEventListener('scroll', this.handleScroll, true)
    document.addEventListener('mousedown', this.handleMouseDown, true)
    window.addEventListener('resize', this.handleScroll)
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    document.removeEventListener('mouseup', this.handleMouseUp, true)
    document.removeEventListener('selectionchange', this.handleSelectionChange)
    document.removeEventListener('keyup', this.handleKeyUp, true)
    document.removeEventListener('scroll', this.handleScroll, true)
    document.removeEventListener('mousedown', this.handleMouseDown, true)
    window.removeEventListener('resize', this.handleScroll)
    if (this.updateTimer !== undefined) window.clearTimeout(this.updateTimer)
  }

  getCurrent(): TextSelection | null {
    return this.selection
  }

  getCurrentRange(): Range | null {
    return this.range?.cloneRange() ?? null
  }

  hide(): void {
    this.onSelection(null)
  }

  private readonly handleMouseUp = (event: MouseEvent) => {
    const target = event.target instanceof Node ? event.target : null
    if (shouldIgnoreSelectionTarget(target)) return
    this.scheduleUpdate(0)
  }

  private readonly handleSelectionChange = () => this.scheduleUpdate(80)

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.hide()
      return
    }
    this.scheduleUpdate(0)
  }

  private readonly handleScroll = () => this.hide()

  private readonly handleMouseDown = (event: MouseEvent) => {
    const target = event.target instanceof Node ? event.target : null
    if (!shouldIgnoreSelectionTarget(target)) this.hide()
  }

  private scheduleUpdate(delay: number): void {
    if (this.updateTimer !== undefined) window.clearTimeout(this.updateTimer)
    this.updateTimer = window.setTimeout(() => this.update(), delay)
  }

  private update(): void {
    const browserSelection = window.getSelection()
    const text = browserSelection?.toString() ?? ''

    if (
      !browserSelection ||
      browserSelection.rangeCount === 0 ||
      browserSelection.isCollapsed ||
      !isMeaningfulSelectionText(text) ||
      shouldIgnoreSelectionTarget(browserSelection.anchorNode)
    ) {
      this.selection = null
      this.range = null
      this.onSelection(null)
      return
    }

    const range = browserSelection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) return

    this.range = range.cloneRange()
    this.selection = {
      text: text.replace(/\s+/gu, ' ').trim(),
      pageUrl: window.location.href,
      pageTitle: document.title,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      timestamp: Date.now(),
      isLargeSelection:
        text.length > 1000 ||
        (Math.min(rect.width, window.innerWidth) *
          Math.min(rect.height, window.innerHeight)) /
          Math.max(1, window.innerWidth * window.innerHeight) >
          0.55,
    }
    this.onSelection(this.selection)
  }
}
