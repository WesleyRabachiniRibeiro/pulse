import { clipboard } from 'electron'
import type { ClipboardWriter } from '../../ports/clipboard-writer'

export class ElectronClipboardWriter implements ClipboardWriter {
  writeText(text: string): void {
    clipboard.writeText(text)
  }
}
