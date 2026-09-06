import type { Check } from '@shared/domain/preflight'
import s from './CheckCard.module.css'

export function CheckCard({ check }: { check: Check }) {
  return (
    <div className={s.card} data-status={check.status}>
      <div className={s.dot} aria-hidden />
      <div className={s.body}>
        <div className={s.title}>{check.title}</div>
        <div className={s.detail}>{check.detail}</div>
        {check.fix && <p className={s.fix}>{check.fix}</p>}
      </div>
    </div>
  )
}

export function CheckCardSkeleton({ label }: { label?: string }) {
  return (
    <div className={s.card} data-status="checking">
      <div className={s.dot} aria-hidden />
      <div className={s.body}>
        <div className={s.title}>{label ?? 'Verificando…'}</div>
        <div className={s.detail}>verificando…</div>
      </div>
    </div>
  )
}
