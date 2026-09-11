import { normalizeText } from '@pulse/domain'

export function hex(code: number): string {
  return `0x${(code >>> 0).toString(16).toUpperCase()}`
}

function isCode(code: number, ...knownCodes: readonly number[]): boolean {
  return knownCodes.includes(code >>> 0)
}

// O winget nem sempre devolve um código de saída exclusivo para cada situação
// (às vezes reaproveita códigos genéricos do Windows/MSI), então o código é o
// sinal principal, mas quando ele não basta a última linha (em PT ou EN, a
// depender do idioma do Windows) ainda precisa de casamento de texto.

const ALREADY_INSTALLED_CODES = [0x8a15002b]
const ALREADY_INSTALLED_TEXT = [
  'nenhuma atualizacao',
  'nenhuma versao de pacote mais recente',
  'no available upgrade',
  'no applicable upgrade',
  'no newer package version',
]

export function alreadyInstalled(code: number, output: string): boolean {
  if (isCode(code, ...ALREADY_INSTALLED_CODES)) return true
  const text = normalizeText(output)
  return ALREADY_INSTALLED_TEXT.some((needle) => text.includes(needle))
}

const NEEDS_ADMIN_CODES = [5, 740, 0x80070005, 0x800702e4]
const NEEDS_ADMIN_TEXT = ['acesso negado', 'access is denied', '0x80070005']

export function needsAdmin(code: number, output: string): boolean {
  if (isCode(code, ...NEEDS_ADMIN_CODES)) return true
  const text = normalizeText(output)
  return NEEDS_ADMIN_TEXT.some((needle) => text.includes(needle))
}

const REFUSED_ELEVATION_CODES = [1223, 0x800704c7]

export function refusedElevation(code: number): boolean {
  return isCode(code, ...REFUSED_ELEVATION_CODES)
}

const NEEDS_REBOOT_CODES = [3010, 1641, 0x80070bc2, 0x80070669]
const NEEDS_REBOOT_TEXT = [
  'reinicializacao necessaria',
  'reinicie o computador',
  'reinicializacao do sistema',
  'restart required',
  'reboot required',
  'restart your computer',
]

export function needsReboot(code: number, output: string): boolean {
  if (isCode(code, ...NEEDS_REBOOT_CODES)) return true
  const text = normalizeText(output)
  return NEEDS_REBOOT_TEXT.some((needle) => text.includes(needle))
}

const INSTALLER_BUSY_CODES = [1618, 0x80070652]
const INSTALLER_BUSY_TEXT = ['outra instalacao', 'another installation', '1618', '0x80070652']

export function installerBusy(code: number, output: string): boolean {
  if (isCode(code, ...INSTALLER_BUSY_CODES)) return true
  const text = normalizeText(output)
  return INSTALLER_BUSY_TEXT.some((needle) => text.includes(needle))
}

export function refusedDrive(output: string): boolean {
  const text = normalizeText(output)
  return text.includes('location') || text.includes('local de instalacao')
}

export function refusesElevation(output: string): boolean {
  const text = normalizeText(output)
  return text.includes('contexto de administrador') || text.includes('administrator context')
}

export function wingetErrorMessage(code: number, output: string, name: string): string {
  if (refusesElevation(output)) {
    return `O instalador do ${name} não roda com o Pulse aberto como administrador. Feche o app e abra de novo sem "Executar como administrador".`
  }
  if (refusedElevation(code)) {
    return `A permissão do Windows para instalar o ${name} foi recusada. Tente de novo e responda Sim na janela do Windows.`
  }
  if (needsAdmin(code, output)) {
    return `O instalador do ${name} precisou de permissão de administrador e não recebeu. Tente de novo e clique em "Conceder permissão" quando o Pulse pedir.`
  }
  const last = output
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .at(-1)
  return `O winget encerrou com ${hex(code)}.${last ? ` Última mensagem: ${last}` : ''}`
}
