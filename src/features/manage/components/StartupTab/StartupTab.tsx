import type { StartupEntry } from '@shared/domain/windows'
import { getProgram } from '@shared/domain/catalog'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { setStartup, useStartupBusy } from '../../store/useStartup'
import s from '../tabs.module.css'

export function Startup({ entries, loaded }: { entries: readonly StartupEntry[]; loaded: boolean }) {
  if (!loaded) return <p className={s.empty}>Lendo o que abre junto com o Windows…</p>
  if (entries.length === 0) {
    return <p className={s.empty}>Nada se cadastrou para abrir junto com o Windows.</p>
  }

  return (
    <>
      {entries.map((entry) => (
        <StartupItem key={entry.name} entry={entry} />
      ))}
    </>
  )
}

function StartupItem({ entry }: { entry: StartupEntry }) {
  const busy = useStartupBusy(entry.name)
  const program = entry.programId ? getProgram(entry.programId) : undefined

  return (
    <div className={s.item}>
      {program ? (
        <AppIcon id={program.id} name={program.name} size={28} />
      ) : (
        <span className={s.stranger}>—</span>
      )}

      <span className={s.body}>
        <span className={s.name}>{program?.name ?? entry.name}</span>
        <span className={s.note}>{entry.value || entry.name}</span>
      </span>

      <button
        type="button"
        className={s.toggle}
        data-on={entry.enabled}
        disabled={busy}
        onClick={() => void setStartup(entry.name, !entry.enabled)}
      >
        {busy ? 'MUDANDO…' : entry.enabled ? 'ABRE' : 'NÃO ABRE'}
      </button>
    </div>
  )
}
