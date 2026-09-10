import { foldText } from './text'

export function hex(code: number): string {
  return `0x${(code >>> 0).toString(16).toUpperCase()}`
}

export function is(code: number, ...codes: readonly number[]): boolean {
  return codes.includes(code >>> 0)
}

export function alreadyInstalled(code: number, output: string): boolean {
  if (hex(code) === '0x8A15002B') return true

  const t = foldText(output)
  return (
    t.includes('nenhuma atualizacao') ||
    t.includes('nenhuma versao de pacote mais recente') ||
    t.includes('no available upgrade') ||
    t.includes('no applicable upgrade') ||
    t.includes('no newer package version')
  )
}

export function needsAdmin(code: number, output: string): boolean {
  if (is(code, 5, 740, 0x80070005, 0x800702e4)) return true
  const t = foldText(output)
  return t.includes('acesso negado') || t.includes('access is denied') || t.includes('0x80070005')
}

export function refusedElevation(code: number): boolean {
  return is(code, 1223, 0x800704c7)
}

export function needsReboot(code: number, output: string): boolean {
  if (is(code, 3010, 1641, 0x80070bc2, 0x80070669)) return true
  const t = foldText(output)
  return (
    t.includes('reinicializacao necessaria') ||
    t.includes('reinicie o computador') ||
    t.includes('reinicializacao do sistema') ||
    t.includes('restart required') ||
    t.includes('reboot required') ||
    t.includes('restart your computer')
  )
}

export function installerBusy(code: number, output: string): boolean {
  if (is(code, 1618, 0x80070652)) return true
  const t = foldText(output)
  return (
    t.includes('outra instalacao') ||
    t.includes('another installation') ||
    t.includes('1618') ||
    t.includes('0x80070652')
  )
}

export function refusedDrive(output: string): boolean {
  const t = foldText(output)
  return t.includes('location') || t.includes('local de instalacao')
}

export function refusesElevation(output: string): boolean {
  const t = foldText(output)
  return t.includes('contexto de administrador') || t.includes('administrator context')
}

export function errorMessage(code: number, output: string, name: string): string {
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
