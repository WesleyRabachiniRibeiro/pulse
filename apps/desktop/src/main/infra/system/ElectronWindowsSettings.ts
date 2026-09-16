import { shell } from 'electron'
import type { WindowsSettings } from '../../ports/windows-settings'

const FAMILY_PAGE = 'ms-settings:family-group'

export class ElectronWindowsSettings implements WindowsSettings {
  async openFamily(): Promise<void> {
    await shell.openExternal(FAMILY_PAGE)
  }
}
