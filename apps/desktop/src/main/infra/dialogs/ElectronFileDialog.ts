import { BrowserWindow, dialog } from 'electron'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  FileDialog,
  OpenedFile,
  SaveOutcome,
  SaveRequest,
} from '../../ports/file-dialog'

export class ElectronFileDialog implements FileDialog {
  async save(request: SaveRequest): Promise<{ outcome: SaveOutcome; path?: string }> {
    const { canceled, filePath } = await dialog.showSaveDialog(this.parent(), {
      defaultPath: request.startIn
        ? join(request.startIn, `${request.suggestedName}.${request.extension}`)
        : `${request.suggestedName}.${request.extension}`,
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

  async openText(
    filterName: string,
    extensions: readonly string[],
    startIn?: string,
  ): Promise<OpenedFile | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog(this.parent(), {
      properties: ['openFile'],
      filters: [{ name: filterName, extensions: [...extensions] }],
      ...(startIn ? { defaultPath: startIn } : {}),
    })

    const path = filePaths[0]
    if (canceled || !path) return null

    const contents = await readFile(path, 'utf8').catch(() => null)
    return contents === null ? null : { path, contents }
  }

  async pickFolder(): Promise<string | null> {
    const { canceled, filePaths } = await dialog.showOpenDialog(this.parent(), {
      properties: ['openDirectory', 'createDirectory'],
    })

    return canceled ? null : (filePaths[0] ?? null)
  }

  private parent(): BrowserWindow {
    const [first] = BrowserWindow.getAllWindows()
    if (!first) throw new Error('[dialog] nenhuma janela aberta')
    return first
  }
}
