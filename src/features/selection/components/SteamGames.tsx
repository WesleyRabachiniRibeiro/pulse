import { useCallback, useEffect, useState } from 'react'
import { LuSearch } from 'react-icons/lu'
import { formatBytes, type SteamGame, type SteamLibrary } from '@shared/domain/steam'
import { bridge } from '@/shared/lib/bridge'
import s from './AppSettings.module.css'

interface Props {
  chosen: readonly SteamGame[]
  onToggle: (game: SteamGame) => void
}

const SEARCH_DELAY = 350

export function SteamGames({ chosen, onToggle }: Props) {
  const [library, setLibrary] = useState<SteamLibrary | null>(null)
  const [term, setTerm] = useState('')
  const [found, setFound] = useState<SteamGame[]>([])
  const [searching, setSearching] = useState(false)

  const reload = useCallback(() => {
    setLibrary(null)
    void bridge
      .invoke('steam:library', undefined)
      .then(setLibrary)
      .catch(() => setLibrary({ hasSteam: false, installed: [], owned: [] }))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const clean = term.trim()
    if (clean.length < 2) {
      setFound([])
      setSearching(false)
      return
    }

    setSearching(true)
    const t = setTimeout(() => {
      void bridge
        .invoke('steam:search', { term: clean })
        .then(setFound)
        .catch(() => setFound([]))
        .finally(() => setSearching(false))
    }, SEARCH_DELAY)

    return () => clearTimeout(t)
  }, [term])

  const isChecked = (appid: string) => chosen.some((g) => g.appid === appid)
  const searchingSomething = term.trim().length >= 2

  const installedHere = new Set((library?.installed ?? []).map((g) => g.appid))
  const owned = library?.owned ?? []
  const inLibrary = owned.length > 0 ? owned : (library?.installed ?? [])

  function row(game: SteamGame, tag: string) {
    const alreadyInstalled = installedHere.has(game.appid)
    const picked = isChecked(game.appid)

    return (
      <button
        key={game.appid}
        type="button"
        role="checkbox"
        aria-checked={alreadyInstalled || picked}
        aria-disabled={alreadyInstalled}
        data-installed={alreadyInstalled}
        className={s.option}
        disabled={alreadyInstalled}
        onClick={() => onToggle({ appid: game.appid, name: game.name })}
      >
        <span className={s.box} aria-hidden>
          {alreadyInstalled || picked ? '✓' : ''}
        </span>
        <span className={s.optionBody}>
          <span className={s.optionName}>{game.name}</span>
          <span className={s.optionHint}>
            {game.bytes
              ? `${formatBytes(game.bytes)} em ${game.drive ?? 'disco'}`
              : `appid ${game.appid}`}
          </span>
        </span>
        <span className={s.optionCategory}>{alreadyInstalled ? 'JÁ NO SEU PC' : tag}</span>
      </button>
    )
  }

  return (
    <>
      <div className={s.search}>
        <LuSearch className={s.magnifier} size={15} aria-hidden />
        <input
          className={s.searchInput}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar qualquer jogo na Steam…"
          aria-label="Buscar na Steam"
        />
        <span className={s.count}>
          {searchingSomething
            ? searching
              ? 'procurando…'
              : `${found.length} achados`
            : `${inLibrary.length} ${owned.length > 0 ? 'na sua biblioteca' : 'nesta máquina'}`}
        </span>
      </div>

      <div className={s.options}>
        {searchingSomething ? (
          found.length === 0 && !searching ? (
            <p className={s.empty}>Nada com esse nome na Steam.</p>
          ) : (
            found.map((g) => row(g, 'STEAM'))
          )
        ) : library === null ? (
          <p className={s.empty}>Lendo a sua biblioteca…</p>
        ) : !library.hasSteam ? (
          <p className={s.empty}>
            A Steam ainda não está nesta máquina. Depois que ela for instalada, os jogos daqui
            entram na fila dela. Enquanto isso, dá para buscar pelo nome no campo acima.
          </p>
        ) : inLibrary.length === 0 ? (
          <p className={s.empty}>
            A Steam está aqui, mas ainda não guardou nenhuma biblioteca nesta máquina. Isso
            acontece antes do primeiro login. Busque pelo nome acima para pedir qualquer jogo.
          </p>
        ) : (
          inLibrary.map((g) => row(g, owned.length > 0 ? 'BIBLIOTECA' : 'INSTALADO'))
        )}
      </div>

      {chosen.length > 0 && (
        <p className={s.chosenNote}>
          {chosen.length === 1 ? 'Escolhido: ' : 'Escolhidos: '}
          {chosen.map((g) => g.name).join(', ')}
        </p>
      )}
    </>
  )
}
