import { homedir } from 'node:os'
import { join } from 'node:path'
import { access } from 'node:fs/promises'
import type { SyncFolder, SyncFolders } from '../../ports/sync-folders'

const CANDIDATES: readonly { label: string; from: () => string | undefined }[] = [
  { label: 'OneDrive', from: () => process.env['OneDrive'] },
  { label: 'OneDrive', from: () => join(homedir(), 'OneDrive') },
  { label: 'Google Drive', from: () => join(homedir(), 'Google Drive') },
  { label: 'Dropbox', from: () => join(homedir(), 'Dropbox') },
]

export class NodeSyncFolders implements SyncFolders {
  async list(): Promise<readonly SyncFolder[]> {
    const found: SyncFolder[] = []

    for (const candidate of CANDIDATES) {
      const path = candidate.from()
      if (!path) continue
      if (found.some((one) => one.path === path)) continue

      const there = await access(path)
        .then(() => true)
        .catch(() => false)

      if (there) found.push({ path, label: candidate.label })
    }

    return found
  }
}
