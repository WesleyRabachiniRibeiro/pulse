import { spawn } from 'node:child_process'
import { hasManifest, isSignedIn } from '../steam'

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

const SCRIPT_LIMIT_MS = 25_000

function steamDialogOpen(): Promise<boolean> {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class SteamEye {
  public delegate bool Callback(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb, IntPtr p);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@

$pids = @(Get-Process | Where-Object { $_.ProcessName -like 'steam*' } | ForEach-Object { $_.Id })
if (-not $pids) { Write-Output 'closed'; exit }

$found = $false
$cb = [SteamEye+Callback]{
  param($h, $p)
  if (-not [SteamEye]::IsWindowVisible($h)) { return $true }
  $owner = 0
  [void][SteamEye]::GetWindowThreadProcessId($h, [ref]$owner)
  if ($pids -notcontains $owner) { return $true }
  $sb = New-Object Text.StringBuilder 512
  [void][SteamEye]::GetWindowTextW($h, $sb, 512)
  $t = $sb.ToString()
  if ($t -like 'Instalar*' -or $t -like 'Install*') { $script:found = $true; return $false }
  return $true
}
[void][SteamEye]::EnumWindows($cb, [IntPtr]::Zero)

if ($found) { Write-Output 'open' } else { Write-Output 'closed' }
`

  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true },
    )
    let output = ''
    child.stdout?.on('data', (b: Buffer) => (output += b.toString('utf8')))
    child.stderr?.resume()

    const giveUp = setTimeout(() => child.kill(), SCRIPT_LIMIT_MS)
    const finish = (value: boolean): void => {
      clearTimeout(giveUp)
      resolve(value)
    }

    child.on('error', () => finish(false))
    child.on('close', () => finish(output.includes('open')))
  })
}
