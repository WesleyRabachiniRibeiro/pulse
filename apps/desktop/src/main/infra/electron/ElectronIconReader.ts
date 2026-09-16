import { app } from 'electron'
import type { IconReader } from '../../ports/icon-reader'

export class ElectronIconReader implements IconReader {
  async read(path: string): Promise<string | null> {
    try {
      const image = await app.getFileIcon(path, { size: 'normal' })
      return image.isEmpty() ? null : image.toDataURL()
    } catch {
      return null
    }
  }
}
