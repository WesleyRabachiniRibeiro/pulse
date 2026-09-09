import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { programSchema, type Program } from '@shared/domain/catalog'
import { z } from 'zod'

const extrasSchema = z.array(programSchema)

function file(): string {
  return join(app.getPath('userData'), 'meus-programas.json')
}

export async function readExtras(): Promise<Program[]> {
  try {
    const read = extrasSchema.safeParse(JSON.parse(await readFile(file(), 'utf8')))
    return read.success ? read.data : []
  } catch {
    return []
  }
}

export async function saveExtras(programs: readonly Program[]): Promise<void> {
  try {
    const path = file()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(programs, null, 2)}\n`, 'utf8')
  } catch {
    /* empty */
  }
}
