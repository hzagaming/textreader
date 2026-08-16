import type { ReaderDocument, ReaderParagraph, ReaderSentence } from '@textreader/shared'

type ReaderTextScope = 'sentence' | 'paragraph'

function normalizeText(text: string): string {
  return text.replace(/\s+/gu, ' ').trim()
}

function countOccurrences(text: string, query: string): number {
  if (!query) return 0
  let count = 0
  let index = 0
  while ((index = text.indexOf(query, index)) >= 0) {
    count += 1
    index += query.length
  }
  return count
}

export class ReaderQueue {
  private document: ReaderDocument | undefined
  private sentences: ReaderSentence[] = []
  private sentenceIndex = 0

  loadDocument(
    document: ReaderDocument,
    startSentenceIndex = 0,
  ): ReaderSentence | undefined {
    this.document = document
    this.sentences = document.paragraphs.flatMap((paragraph) => paragraph.sentences)
    return this.jumpToSentence(startSentenceIndex)
  }

  current(): ReaderSentence | undefined {
    return this.sentences[this.sentenceIndex]
  }

  next(): ReaderSentence | undefined {
    return this.jumpToSentence(this.sentenceIndex + 1)
  }

  previous(): ReaderSentence | undefined {
    return this.jumpToSentence(this.sentenceIndex - 1)
  }

  jumpToSentence(index: number): ReaderSentence | undefined {
    if (this.sentences.length === 0) return undefined
    this.sentenceIndex = Math.min(
      this.sentences.length - 1,
      Math.max(0, Math.trunc(index)),
    )
    return this.current()
  }

  jumpToParagraph(index: number): ReaderSentence | undefined {
    if (!this.document || this.document.paragraphs.length === 0) return undefined
    const paragraphIndex = Math.min(
      this.document.paragraphs.length - 1,
      Math.max(0, Math.trunc(index)),
    )
    const sentence = this.document.paragraphs[paragraphIndex]?.sentences[0]
    return sentence ? this.jumpToSentence(sentence.index) : undefined
  }

  nextParagraph(): ReaderSentence | undefined {
    return this.jumpToParagraph(this.currentParagraphIndex() + 1)
  }

  previousParagraph(): ReaderSentence | undefined {
    return this.jumpToParagraph(this.currentParagraphIndex() - 1)
  }

  restart(): ReaderSentence | undefined {
    return this.jumpToSentence(0)
  }

  clear(): void {
    this.document = undefined
    this.sentences = []
    this.sentenceIndex = 0
  }

  currentParagraph(): ReaderParagraph | undefined {
    const paragraphId = this.current()?.paragraphId
    return this.document?.paragraphs.find((paragraph) => paragraph.id === paragraphId)
  }

  currentParagraphIndex(): number {
    return this.currentParagraph()?.index ?? 0
  }

  getDocument(): ReaderDocument | undefined {
    return this.document
  }

  getSentences(): readonly ReaderSentence[] {
    return this.sentences
  }

  getSentenceIndex(): number {
    return this.sentenceIndex
  }

  currentTextOccurrence(scope: ReaderTextScope): number {
    const items =
      scope === 'paragraph' ? (this.document?.paragraphs ?? []) : this.sentences
    const currentIndex =
      scope === 'paragraph' ? this.currentParagraphIndex() : this.sentenceIndex
    const query = normalizeText(items[currentIndex]?.text ?? '')
    return items
      .slice(0, currentIndex)
      .reduce(
        (count, item) => count + countOccurrences(normalizeText(item.text), query),
        0,
      )
  }
}
