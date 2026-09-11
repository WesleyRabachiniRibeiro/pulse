import { LuHouse } from 'react-icons/lu'
import s from './StepRail.module.css'

export const STEPS = [
  { n: 1, title: 'Verificação' },
  { n: 2, title: 'Seleção' },
  { n: 3, title: 'Instalação' },
  { n: 4, title: 'Resumo' },
] as const

interface Props {
  onHome: () => void
  atHome: boolean
  current: number
  available: readonly number[]
  onGo: (n: number) => void
  selected: number
  size: string
}

export function StepRail({ onHome, atHome, current, available, onGo, selected, size }: Props) {
  return (
    <nav className={s.rail} aria-label="Etapas">
      <button
        type="button"
        className={s.home}
        data-current={atHome}
        aria-current={atHome ? 'page' : undefined}
        onClick={onHome}
      >
        <LuHouse className={s.homeIcon} size={15} aria-hidden />
        <span className={s.title}>Início</span>
      </button>

      <div className={s.label}>ETAPAS</div>

      {STEPS.map((step) => {
        const canGo = step.n !== current && available.includes(step.n)
        return (
          <button
            key={step.n}
            className={s.step}
            data-tour={step.n}
            data-current={step.n === current}
            disabled={!canGo && step.n !== current}
            aria-current={step.n === current ? 'step' : undefined}
            onClick={() => canGo && onGo(step.n)}
          >
            <span className={s.number}>{String(step.n).padStart(2, '0')}</span>
            <span className={s.title}>{step.title}</span>
          </button>
        )
      })}

      <div className={s.spacer} />

      <div className={s.summary}>
        <div className={s.summaryLabel}>SELECIONADOS</div>
        <div className={s.summaryValue}>{selected}</div>
        <div className={s.summaryNote}>{size}</div>
      </div>
    </nav>
  )
}
