import { TIBIA_BY_ID } from '@pulse/catalog-data'
import { runnerFor, wait, type StepResult } from './context'

export const tibiaPages = runnerFor<string[]>(async (ids, ctx) => {
  const result: StepResult = { pagesOpened: [] }
  if (ids.length === 0) return result

  for (const [index, id] of ids.entries()) {
    const client = TIBIA_BY_ID.get(id)
    if (!client?.url) continue

    ctx.say(`Abrindo a página do ${client.name} (${index + 1}/${ids.length})`)

    if (await ctx.ports.processRunner.openUri(client.url)) {
      result.pagesOpened?.push(client.name)
      ctx.note(`${client.name}: página oficial aberta no navegador`, 'ok')
    } else {
      ctx.note(`${client.name}: não deu para abrir a página`, 'error')
    }

    await wait(1200)
  }

  return result
})
