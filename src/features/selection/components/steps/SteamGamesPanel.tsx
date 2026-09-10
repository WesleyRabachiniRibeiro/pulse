import type { SteamGame } from '@shared/domain/steam'
import { SteamGames } from '../SteamGames'
import type { PanelProps } from './panel'

export function SteamGamesPanel({ value, onChange }: PanelProps<SteamGame[]>) {
  const chosen = value ?? []

  function toggle(game: SteamGame) {
    const next = chosen.some((one) => one.appid === game.appid)
      ? chosen.filter((one) => one.appid !== game.appid)
      : [...chosen, game]
    onChange(next.length > 0 ? next : undefined)
  }

  return <SteamGames chosen={chosen} onToggle={toggle} />
}
