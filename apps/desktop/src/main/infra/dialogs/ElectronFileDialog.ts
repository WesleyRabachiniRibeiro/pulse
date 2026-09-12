import { BrowserWindow, dialog } from 'electron'
import { writeFile, readFile } from 'node:fs/promises'
import type {
  FileDialog,
  OpenedFile,
  SaveOutcome,
  SaveRequest,
} from '../../ports/file-dialog'

export class ElectronFileDialog implements FileDialog {
  async save(request: SaveRequest): Promise<{ outcome: SaveOutcome; path?: string }> {
    const { canceled, filePath } = await dialog.showSaveDialog(this.parent(), {
      defaultPath: `${request.suggestedName}.${request.extension}`,
      filters: [{ name: request.filterName, extensions: [request.extension] }],
    })

    if (canceled || !filePath) return { outcome: 'canceled' }

    try {
      await writeFile(filePath, request.contents, 'utf8')
      return { outcome: 'saved', path: filePath }
    } catch {
      return { outcome: 'failed' }
    }
  }

  async openText(filterName: string, extensions: readonly string[]): Promise<OpenedFile | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog(this.parent(), {
      properties: ['openFile'],
      filters: [{ name: filterName, extensions: [...extensions] }],
    })

    const path = filePaths[0]
    if (canceled || !path) return null

    const contents = await readFile(path, 'utf8').catch(() => null)
    return contents === null ? null : { path, contents }
  }

  // Sem janela pai o diálogo abre solto e some atrás do app.
  private parent(): BrowserWindow {
    const [first] = BrowserWindow.getAllWindows()
    if (!first) throw new Error('[dialog] nenhuma janela aberta')
    return first
  }
}
