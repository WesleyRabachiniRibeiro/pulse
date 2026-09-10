import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  readTweakState,
  TWEAK_BY_ID,
  TWEAKS,
  tweaksTouchingExplorer,
  type TweakState,
} from '@shared/domain/windows'
import { run } from '@main/core/powershell'
import refreshExplorerScript from './infrastructure/powershell/RefreshExplorer.ps1?raw'

const exec = promisify(execFile)

const CALL_TIMEOUT_MS = 10_000

async function readValue(key: string, name: string): Promise<number | null> {
  const { stdout } = await exec('reg', ['query', key, '/v', name], {
    windowsHide: true,
    timeout: CALL_TIMEOUT_MS,
  }).catch(() => ({ stdout: '' }))

  const found = /REG_DWORD\s+0x([0-9a-f]+)/i.exec(stdout)
  return found?.[1] ? Number.parseInt(found[1], 16) : null
}

async function writeValue(key: string, name: string, value: number): Promise<boolean> {
  return exec('reg', ['add', key, '/v', name, '/t', 'REG_DWORD', '/d', String(value), '/f'], {
    windowsHide: true,
    timeout: CALL_TIMEOUT_MS,
  })
    .then(() => true)
    .catch(() => false)
}

async function refreshExplorer(): Promise<void> {
  await run(refreshExplorerScript, { timeoutMs: CALL_TIMEOUT_MS }).catch(() => undefined)
}

export async function readTweaks(): Promise<TweakState[]> {
  const wanted = new Map<string, { key: string; name: string }>()
  for (const tweak of TWEAKS) {
    for (const value of tweak.values) {
      wanted.set(`${value.key}\\${value.name}`, { key: value.key, name: value.name })
    }
  }

  const found = new Map<string, number>()
  await Promise.all(
    [...wanted.entries()].map(async ([id, where]) => {
      const value = await readValue(where.key, where.name)
      if (value !== null) found.set(id, value)
    }),
  )

  return TWEAKS.map((tweak) => ({ id: tweak.id, on: readTweakState(tweak, found) }))
}

export async function writeTweak(id: string, on: boolean): Promise<TweakState[]> {
  const tweak = TWEAK_BY_ID.get(id)
  if (!tweak) return readTweaks()

  for (const value of tweak.values) {
    await writeValue(value.key, value.name, on ? value.on : value.off)
  }

  if (tweaksTouchingExplorer([id])) await refreshExplorer()

  return readTweaks()
}
