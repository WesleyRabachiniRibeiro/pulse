import type { Check, CheckStatus } from '@pulse/domain'
import s from './CheckCard.module.css'

const ICONS: Record<CheckStatus | 'checking', string> = {
  ok: '✓',
  warning: '!',
  blocker: '✕',
  checking: '·',
}

export function CheckCard({ check }: { check: Check }) {
  return (
    <div className={s.row} data-status={check.status}>
      <div className={s.line}>
        <span className={s.mark} aria-hidden>
          {ICONS[check.status]}
        </span>
        <span className={s.title}>{check.title}</span>
        <span className={s.value}>{check.detail}</span>
      </div>
      {check.fix && <p className={s.fix}>{check.fix}</p>}
    </div>
  )
}

export function CheckCardSkeleton({ label }: { label?: string }) {
  return (
    <div className={s.row} data-status="checking">
      <div className={s.line}>
        <span className={s.mark} aria-hidden>
          {ICONS.checking}
        </span>
        <span className={s.title}>{label ?? 'Verificando…'}</span>
        <span className={s.value}>verificando…</span>
      </div>
    </div>
  )
}
