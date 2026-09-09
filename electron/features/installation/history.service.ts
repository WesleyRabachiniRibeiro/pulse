import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { historySchema, recordOf, withRecord, type RunRecord } from '@shared/domain/history'
import type { Run } from '@shared/domain/installation'

function file(): string {
  return join(app.getPath('userData'), 'runs.json')
}

let cache: RunRecord[] | null = null

export function forgetHistory(): void {
  cache = null
}

export async function readHistory(): Promise<RunRecord[]> {
  if (cache) return cache

  try {
    const raw: unknown = JSON.parse(await readFile(file(), 'utf8'))
    const read = historySchema.safeParse(raw)
    cache = read.success ? read.data : []
  } catch {
    cache = []
  }

  return cache
}

export async function rememberRun(run: Run): Promise<void> {
  const record = recordOf(run)
  if (!record) return

  const next = withRecord(await readHistory(), record)
  cache = next

  try {
    const path = file()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(next, null, 2), 'utf8')
  } catch {
    /* empty */
  }
}
