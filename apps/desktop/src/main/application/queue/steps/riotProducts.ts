import { RIOT_BY_ID } from '@pulse/catalog-data'
import { runnerFor, type StepResult } from './context'

export const riotProducts = runnerFor<string[]>(async (ids, ctx) => {
  const result: StepResult = { riotInstalled: [], riotFailed: [] }
  if (ids.length === 0) return result

  const system = (process.env['SystemDrive'] ?? 'C:').toUpperCase()

  for (const [index, packageId] of ids.entries()) {
    const name = RIOT_BY_ID.get(packageId)?.name ?? packageId
    const position = ids.length > 1 ? ` (${index + 1}/${ids.length})` : ''

    ctx.progress(0)
    ctx.say(`Instalando ${name}${position}`)
    ctx.note(`${ctx.program.name}: instalando ${name}`, 'step')

    const destination =
      ctx.drive.toUpperCase() === system ? undefined : `${ctx.drive}\Pulse\${packageId}`

    const outcome = await ctx.ports.packageInstaller.install(
      {
        itemId: ctx.itemId,
        packageId,
        name,
        drive: ctx.drive,
        fromStore: false,
        ...(destination ? { destination } : {}),
      },
      (progress) => {
        if (progress.percent !== undefined) ctx.progress(progress.percent)
      },
    )

    if (outcome.kind === 'ok' || outcome.kind === 'already-installed') {
      result.riotInstalled?.push(name)
      ctx.note(`${name}: instalado`, 'ok')
    } else {
      result.riotFailed?.push(name)
      ctx.note(`${name}: falhou com ${outcome.code}`, 'error')
    }
  }

  ctx.progress(100)
  return result
})
