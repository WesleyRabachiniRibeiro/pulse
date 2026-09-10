import { TIBIA_BY_ID } from '@shared/domain/settings'
import { runCommand } from '../steam.gate'
import { runnerFor } from './context'

const BETWEEN_PAGES_MS = 1200

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const tibiaPages = runnerFor<string[]>(async (pages, ctx) => {
  if (pages.length === 0) return {}

  const pagesOpened: string[] = []

  for (const [index, id] of pages.entries()) {
    const client = TIBIA_BY_ID.get(id)
    if (!client?.url) continue

    ctx.say(`Abrindo a página do ${client.name} (${index + 1}/${pages.length})`)

    if (await runCommand('cmd', ['/c', 'start', '', client.url])) {
      pagesOpened.push(client.name)
      ctx.merge({ pagesOpened })
      ctx.note(`${client.name}: página oficial aberta no navegador`, 'ok')
    } else {
      ctx.note(`${client.name}: não deu para abrir a página`, 'error')
    }

    await wait(BETWEEN_PAGES_MS)
  }

  return { pagesOpened }
})
