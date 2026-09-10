import { RIOT_BY_ID } from '@shared/domain/settings'
import { alreadyInstalled, hex } from '@shared/domain/winget'
import { runnerFor } from './context'

export const riotProducts = runnerFor<string[]>(async (products, ctx) => {
  if (products.length === 0) return {}

  const system = (process.env['SystemDrive'] ?? 'C:').toUpperCase()
  const riotInstalled: string[] = []
  const riotFailed: string[] = []

  for (const [index, packageId] of products.entries()) {
    const name = RIOT_BY_ID.get(packageId)?.name ?? packageId
    const position = products.length > 1 ? ` (${index + 1}/${products.length})` : ''

    ctx.say(`Instalando ${name}${position}`, 0)
    ctx.note(`${ctx.program.name}: instalando ${name}`, 'step')

    const destination =
      ctx.drive.toUpperCase() === system ? undefined : `${ctx.drive}\\Pulse\\${packageId}`

    const output = await ctx.runWinget(packageId, destination)

    if (output.code === 0 || alreadyInstalled(output.code, output.text)) {
      riotInstalled.push(name)
      ctx.note(`${name}: instalado`, 'ok')
    } else {
      riotFailed.push(name)
      ctx.note(`${name}: falhou com ${hex(output.code)}`, 'error')
    }
    ctx.merge({ riotInstalled, riotFailed })
  }

  ctx.progress(100)
  return { riotInstalled, riotFailed }
})
