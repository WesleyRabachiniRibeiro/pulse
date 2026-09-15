export interface SyncFolder {
  path: string
  label: string
}

export interface SyncFolders {
  list(): Promise<readonly SyncFolder[]>
}
