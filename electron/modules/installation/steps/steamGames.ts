import type { SteamGame } from '@shared/domain/steam'
import { isSignedIn } from '../../steam'
import { requestSteamGame, waitForSteamSignIn } from '../steam.gate'
import { runnerFor, type StepResult } from './context'

export const steamGames = runnerFor<SteamGame[]>(async (games, ctx) => {
  if (games.length === 0) return {}

  const found: Required<Pick<StepResult, 'gamesAccepted' | 'gamesRefused' | 'gamesPending'>> = {
    gamesAccepted: [],
    gamesRefused: [],
    gamesPending: [],
  }

  let signedIn = await isSignedIn()

  if (!signedIn) {
    ctx.waitFor('Entre na sua conta Steam para baixar os jogos')
    ctx.note('Steam: esperando você entrar na conta', 'step')
    signedIn = await waitForSteamSignIn()
  }

  if (!signedIn) {
    for (const game of games) found.gamesPending.push(game.name)
    ctx.note('Steam: ninguém entrou na conta, os jogos ficaram para depois', 'error')
  } else {
    for (const [index, game] of games.entries()) {
      const position = games.length > 1 ? ` (${index + 1}/${games.length})` : ''
      ctx.waitFor(`Confirme "${game.name}" na janela da Steam${position}`)
      ctx.note(`Steam: esperando você decidir sobre ${game.name}`, 'step')

      const answer = await requestSteamGame(game.appid)

      if (answer === 'confirmed') {
        found.gamesAccepted.push(game.name)
        ctx.note(`Steam: ${game.name} confirmado, download na fila da Steam`, 'ok')
      } else if (answer === 'refused') {
        found.gamesRefused.push(game.name)
        ctx.note(`Steam: ${game.name} recusado por você`, 'info')
      } else {
        found.gamesPending.push(game.name)
        ctx.note(`Steam: ${game.name} ficou sem resposta e foi deixado para depois`, 'error')
      }
      ctx.merge(found)
    }
  }

  ctx.say('Terminando')
  ctx.note(
    `${ctx.program.name}: ${found.gamesAccepted.length} de ${games.length} jogos aceitos`,
    'ok',
  )

  return found
})
