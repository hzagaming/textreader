import type { TextSelection } from '@textreader/shared'
import {
  isMeaningfulSelectionText,
  shouldIgnoreSelectionTarget,
} from './selection-policy'

type SelectionListener = (selection: TextSelection | null) => void

interface SelectionFingerprint {
  anchorNode: Node | null
  anchorOffset: number
  focusNode: Node | null
  focusOffset: number
}

export class SelectionManager {
  private selection: TextSelection | null = null
  private range: Range | null = null
  private updateTimer: number | undefined
  private ignoredSelection: SelectionFingerprint | undefined
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
    this.cancelScheduledUpdate()
    this.ignoredSelection = undefined
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
    this.updateImmediately()
  }

  private readonly handleSelectionChange = () => {
    const selection = this.selectionFingerprint()
    if (
      selection &&
      this.ignoredSelection &&
      this.sameSelection(selection, this.ignoredSelection)
    ) {
      return
    }
    this.ignoredSelection = undefined
    this.scheduleUpdate(40)
  }

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.clear()
      return
    }
    this.updateImmediately()
  }

  private readonly handleScroll = () => {
    this.cancelScheduledUpdate()
    this.ignoredSelection = this.selectionFingerprint()
    this.hide()
  }

  private readonly handleMouseDown = (event: MouseEvent) => {
    const target = event.target instanceof Node ? event.target : null
    const element = target instanceof Element ? target : target?.parentElement
    if (!element?.closest('[data-textreader-root]')) {
      this.cancelScheduledUpdate()
      this.ignoredSelection = this.selectionFingerprint()
      this.hide()
    }
  }

  private scheduleUpdate(delay: number): void {
    this.cancelScheduledUpdate()
    this.updateTimer = window.setTimeout(() => {
      this.updateTimer = undefined
      this.update()
    }, delay)
  }

  private updateImmediately(): void {
    this.cancelScheduledUpdate()
    this.ignoredSelection = undefined
    this.update()
  }

  private clear(): void {
    this.cancelScheduledUpdate()
    this.ignoredSelection = undefined
    this.selection = null
    this.range = null
    this.onSelection(null)
  }

  private cancelScheduledUpdate(): void {
    if (this.updateTimer !== undefined) window.clearTimeout(this.updateTimer)
    this.updateTimer = undefined
  }

  private selectionFingerprint(): SelectionFingerprint | undefined {
    const selection = window.getSelection()
    if (!selection) return undefined
    return {
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset,
    }
  }

  private sameSelection(
    left: SelectionFingerprint,
    right: SelectionFingerprint,
  ): boolean {
    return (
      left.anchorNode === right.anchorNode &&
      left.anchorOffset === right.anchorOffset &&
      left.focusNode === right.focusNode &&
      left.focusOffset === right.focusOffset
    )
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
      this.clear()
      return
    }

    const range = browserSelection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) {
      this.clear()
      return
    }

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
