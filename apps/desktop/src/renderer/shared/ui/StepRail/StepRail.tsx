import { LuHouse, LuPackage, LuSettings } from 'react-icons/lu'
import { PLACES, TRAIL, type PlaceKey, type Screen } from './screens'
import s from './StepRail.module.css'

interface Props {
  current: Screen
  available: readonly Screen[]
  onGo: (screen: Screen) => void
  selected: number
  size: string
  overrides: number
  updates: number
}

const PLACE_ICON: Record<PlaceKey, typeof LuSettings> = {
  config: LuSettings,
  manage: LuPackage,
}

function badgeFor(key: PlaceKey, overrides: number, updates: number): string {
  if (key === 'config') return overrides > 0 ? `${overrides} exc` : ''
  return updates > 0 ? String(updates) : ''
}

export function StepRail({
  current,
  available,
  onGo,
  selected,
  size,
  overrides,
  updates,
}: Props) {
  const atHome = current === 'home'

  return (
    <nav className={s.rail} aria-label="Navegação">
      <button
        type="button"
        className={s.home}
        data-current={atHome}
        aria-current={atHome ? 'page' : undefined}
        onClick={() => onGo('home')}
      >
        <LuHouse className={s.homeIcon} size={15} aria-hidden />
        <span className={s.title}>Início</span>
      </button>

      <div className={s.label}>PREPARAR ESTE PC</div>

      {TRAIL.map((stop) => {
        const here = stop.key === current
        const canGo = !here && available.includes(stop.key)
        return (
          <button
            key={stop.key}
            type="button"
            className={s.step}
            data-tour={stop.key}
            data-current={here}
            disabled={!canGo && !here}
            aria-current={here ? 'step' : undefined}
            onClick={() => canGo && onGo(stop.key)}
          >
            <span className={s.number}>{stop.number}</span>
            <span className={s.title}>{stop.title}</span>
          </button>
        )
      })}

      <div className={s.label}>SEMPRE DISPONÍVEL</div>

      {PLACES.map((place) => {
        const here = place.key === current
        const Icon = PLACE_ICON[place.key]
        const badge = badgeFor(place.key, overrides, updates)
        return (
          <button
            key={place.key}
            type="button"
            className={s.place}
            data-tour={place.key}
            data-current={here}
            aria-current={here ? 'page' : undefined}
            onClick={() => !here && onGo(place.key)}
          >
            <Icon className={s.placeIcon} size={14} aria-hidden />
            <span className={s.title}>{place.title}</span>
            {badge && <span className={s.badge}>{badge}</span>}
          </button>
        )
      })}

      <div className={s.spacer} />

      <div className={s.summary}>
        <div className={s.summaryLabel}>NA FILA</div>
        <div className={s.summaryValue}>{selected}</div>
        <div className={s.summaryNote}>{size}</div>
      </div>
    </nav>
  )
}
