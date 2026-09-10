import { spawn } from 'node:child_process'
import { hasManifest, isSignedIn } from '../steam'
import { steamDialogOpen } from './infrastructure/steamWindows'

export type SteamAnswer = 'confirmed' | 'refused' | 'timeout'

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function runCommand(command: string, args: readonly string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], { windowsHide: true })
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0))
  })
}

const WAIT_LIMIT_MS = 15 * 60_000

export async function waitForSteamSignIn(): Promise<boolean> {
  await runCommand('cmd', ['/c', 'start', '', 'steam://open/main'])

  const limit = Date.now() + WAIT_LIMIT_MS
  while (Date.now() < limit) {
    await wait(3000)
    if (await isSignedIn()) return true
  }
  return false
}
const READS_UNTIL_GIVING_UP = 3

export async function requestSteamGame(appid: string): Promise<SteamAnswer> {
  if (await hasManifest(appid)) return 'confirmed'

  await runCommand('cmd', ['/c', 'start', '', `steam://install/${appid}`])

  const limit = Date.now() + WAIT_LIMIT_MS
  let withoutDialog = 0
  let grace = 6

  while (Date.now() < limit) {
    await wait(2000)

    if (await hasManifest(appid)) return 'confirmed'

    if (await steamDialogOpen()) {
      withoutDialog = 0
      grace = 0
      continue
    }

    if (grace > 0) {
      grace--
      continue
    }

    withoutDialog++
    if (withoutDialog >= READS_UNTIL_GIVING_UP) {
      return (await hasManifest(appid)) ? 'confirmed' : 'refused'
    }
  }

  return (await hasManifest(appid)) ? 'confirmed' : 'timeout'
}

