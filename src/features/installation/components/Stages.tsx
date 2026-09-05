import { hasSettings, ITEM_STAGES, stageOf, type Item } from '@shared/domain/installation'
import s from './Stages.module.css'

export function Stages({ item }: { item: Item }) {
  const current = stageOf(item)
  const stages = ITEM_STAGES.filter((st) => st.id !== 'settings' || hasSettings(item))
  const currentIndex = stages.findIndex((st) => st.id === current)

  return (
    <ol className={s.track} aria-label="Etapas deste programa">
      {stages.map((stage, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'ahead'

        return (
          <li key={stage.id} className={s.stage} data-state={state}>
            <span className={s.mark} aria-hidden />
            <span className={s.name}>{stage.name}</span>
          </li>
        )
      })}
    </ol>
  )
}
