import { app } from 'electron'
import { join } from 'node:path'

export function scriptsDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'powershell', 'scripts')
  }
  return join(app.getAppPath(), 'resources', 'powershell', 'scripts')
}

export function scriptPath(scriptName: string): string {
  return join(scriptsDir(), scriptName)
}
