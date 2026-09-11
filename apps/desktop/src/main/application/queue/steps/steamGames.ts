import type { SteamGame } from '@pulse/domain'
import type { SteamGameRequester } from '../../../ports/steam-game-requester'
import { runnerFor, wait, type StepResult } from './context'

const WAIT_LIMIT_MS = 15 * 60_000
const READS_UNTIL_GIVING_UP = 3

type Answer = 'confirmed' | 'refused' | 'timeout'

// A Steam não avisa quando a pessoa decide: o único sinal confiável de aceite é
// o manifesto do jogo aparecer. A janela aberta serve só para saber que ainda há
// alguém decidindo, e a carência evita desistir antes de ela abrir.
async function askFor(steam: SteamGameRequester, appid: string): Promise<Answer> {
  const limit = Date.now() + WAIT_LIMIT_MS
  let withoutDialog = 0
  let grace = 6

  while (Date.now() < limit) {
    await wait(2000)

    if (await steam.hasManifest(appid)) return 'confirmed'

    if (await steam.isInstallDialogOpen()) {
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
      return (await steam.hasManifest(appid)) ? 'confirmed' : 'refused'
    }
  }

  return (await steam.hasManifest(appid)) ? 'confirmed' : 'timeout'
}

async function waitForSignIn(ctx: {
  ports: { steamGameRequester: SteamGameRequester; processRunner: { openUri(u: string): Promise<boolean> } }
}): Promise<boolean> {
  await ctx.ports.processRunner.openUri('steam://open/main')

  const limit = Date.now() + WAIT_LIMIT_MS
  while (Date.now() < limit) {
    await wait(3000)
    if (await ctx.ports.steamGameRequester.isSignedIn()) return true
  }
  return false
}

export const steamGames = runnerFor<SteamGame[]>(async (games, ctx) => {
  const result: StepResult = { gamesAccepted: [], gamesRefused: [], gamesPending: [] }
  if (games.length === 0) return result

  const steam = ctx.ports.steamGameRequester
  let signedIn = await steam.isSignedIn()

  if (!signedIn) {
    ctx.waitFor('Entre na sua conta Steam para baixar os jogos')
    ctx.note('Steam: esperando você entrar na conta', 'step')
    signedIn = await waitForSignIn(ctx)
  }

  if (!signedIn) {
    for (const game of games) result.gamesPending?.push(game.name)
    ctx.note('Steam: ninguém entrou na conta, os jogos ficaram para depois', 'error')
    return result
  }

  for (const [index, game] of games.entries()) {
    const position = games.length > 1 ? ` (${index + 1}/${games.length})` : ''
    ctx.waitFor(`Confirme "${game.name}" na janela da Steam${position}`)
    ctx.note(`Steam: esperando você decidir sobre ${game.name}`, 'step')

    const answer = await askFor(steam, game.appid)

    if (answer === 'confirmed') {
      result.gamesAccepted?.push(game.name)
      ctx.note(`Steam: ${game.name} confirmado, download na fila da Steam`, 'ok')
    } else if (answer === 'refused') {
      result.gamesRefused?.push(game.name)
      ctx.note(`Steam: ${game.name} recusado por você`, 'info')
    } else {
      result.gamesPending?.push(game.name)
      ctx.note(`Steam: ${game.name} ficou sem resposta e foi deixado para depois`, 'error')
    }
  }

  ctx.say('Terminando')
  ctx.note(
    `${ctx.program.name}: ${result.gamesAccepted?.length ?? 0} de ${games.length} jogos aceitos`,
    'ok',
  )
  return result
})
