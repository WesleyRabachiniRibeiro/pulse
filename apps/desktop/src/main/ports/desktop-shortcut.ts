import type { Program } from '@pulse/domain'

export type ShortcutResult = 'created' | 'removed' | 'already' | 'not-found'

export interface DesktopShortcut {
  setShortcut(program: Program, on: boolean): Promise<ShortcutResult>
}
