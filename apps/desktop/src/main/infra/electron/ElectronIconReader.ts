import { app } from 'electron'
import type { IconReader } from '../../ports/icon-reader'

// O caminho vem do DisplayIcon do registro, que aponta para um .exe ou .ico
// que pode não existir mais. Ícone é enfeite: se falhar, a linha mostra o
// traço em vez de quebrar a lista.
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
