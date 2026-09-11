const CREATE_PROCESS_BASE = -2000
const CREATE_PROCESS_FLOOR = CREATE_PROCESS_BASE - 0xffff

// Traduz as falhas do próprio mecanismo de Run-AsInteractiveUser.ps1, que não
// vêm do comando pedido (ex.: winget uninstall).
export function runnerFailure(code: number): string | null {
  if (code === -1007) {
    return 'o comando passou do tempo e não terminou'
  }
  if (code === -1006) {
    return 'o Controle de Conta de Usuário está desligado neste Windows, e sem ele todo processo da sua conta roda como administrador'
  }
  if (code === -1001 || code === -1002) {
    return 'não foi possível encontrar a sessão aberta do usuário no Windows'
  }
  if (code >= -1005 && code <= -1003) {
    return 'não foi possível usar as credenciais da sessão do usuário'
  }
  if (code <= CREATE_PROCESS_BASE && code >= CREATE_PROCESS_FLOOR) {
    return `o Windows recusou criar o processo sem elevação, erro ${CREATE_PROCESS_BASE - code}`
  }
  return null
}
