import { randomUUID } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { powershellOut } from './tools'

export interface AdminRunOutput {
  code: number
  text: string
}

export const REFUSED_BY_USER = 1223
const START_FAILED = -1224
const NO_EXIT_CODE = -1225

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function argument(value: string): string {
  return literal(value.replace(/(\\*)"/g, '$1$1\\"'))
}

export async function runAsAdmin(
  exe: string,
  args: readonly string[],
  timeoutMs = 10 * 60_000,
): Promise<AdminRunOutput> {
  const outputFile = join(tmpdir(), `pulse-${randomUUID()}.txt`)

  const inner = `
$parts = @(${args.map(argument).join(', ')})
& ${literal(exe)} @parts 2>&1 | Out-File -FilePath ${literal(outputFile)} -Encoding utf8
$code = $LASTEXITCODE
if ($null -eq $code) { $code = ${NO_EXIT_CODE} }
exit $code
`
  const encoded = Buffer.from(inner, 'utf16le').toString('base64')

  const script = `
$ErrorActionPreference = 'Stop'
try {
  $p = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', '${encoded}') -Verb RunAs -WindowStyle Hidden -PassThru
  $p.WaitForExit()
  $p.ExitCode
} catch [System.ComponentModel.Win32Exception] {
  if ($_.Exception.NativeErrorCode -eq ${REFUSED_BY_USER}) { ${REFUSED_BY_USER} } else { ${START_FAILED} }
} catch {
  ${START_FAILED}
}
`

  const raw = await powershellOut(script, timeoutMs + 30_000)
  const numbers = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^-?\d+$/.test(line))
  const code = Number.parseInt(numbers[numbers.length - 1] ?? '', 10)

  const text = (await readFile(outputFile, 'utf8').catch(() => '')).replace(/^﻿/, '')
  await rm(outputFile, { force: true }).catch(() => {})

  return { code: Number.isNaN(code) ? START_FAILED : code, text }
}

export function adminFailure(code: number, name: string): string | null {
  if (code === START_FAILED) {
    return `O Windows não abriu a janela de permissão para instalar o ${name}. Tente de novo.`
  }
  if (code === NO_EXIT_CODE) {
    return `O instalador do ${name} rodou com permissão de administrador, mas não disse como terminou. Confira se ele ficou instalado.`
  }
  return null
}
