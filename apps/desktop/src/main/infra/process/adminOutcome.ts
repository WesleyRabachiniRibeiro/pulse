// Sentinels emitidos pelo próprio Run-AsAdmin.ps1 (não são códigos do winget):
// 1223 é o Windows recusando a elevação na janela do UAC.
export const REFUSED_BY_USER = 1223
const START_FAILED = -1224
const NO_EXIT_CODE = -1225

export function adminFailure(code: number, name: string): string | null {
  if (code === START_FAILED) {
    return `O Windows não abriu a janela de permissão para instalar o ${name}. Tente de novo.`
  }
  if (code === NO_EXIT_CODE) {
    return `O instalador do ${name} rodou com permissão de administrador, mas não disse como terminou. Confira se ele ficou instalado.`
  }
  return null
}
