import { useState } from 'react'
import { LuChevronDown, LuChevronRight } from 'react-icons/lu'
import {
  HISTORY_LIMIT,
  RUN_STATES,
  RUN_STATE_LABEL,
  RUN_STATE_ONE,
  type RunRecord,
} from '@pulse/domain'
import { runSeconds, tallyOf } from '@pulse/utils'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { useCatalog } from '@/features/catalog'
import { useHistory } from '../store/useHistory'
import shell from './tabs.module.css'
import s from './HistoryTab.module.css'

function when(record: RunRecord): string {
  const started = new Date(record.startedAt)
  const finished = new Date(record.finishedAt)
  const day = started.toLocaleDateString('pt-BR')
  const from = started.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const to = finished.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${day} ${from} → ${to}`
}

function howLong(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  return `${Math.max(1, Math.round(seconds / 60))} min`
}

function Run({ record, index }: { record: RunRecord; index: number }) {
  const catalog = useCatalog()
  const [open, setOpen] = useState(index === 0)
  const many = record.items.length

  return (
    <div className={s.run}>
      <button
        type="button"
        className={s.runHead}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={s.runCaret} aria-hidden>
          {open ? <LuChevronDown size={14} /> : <LuChevronRight size={14} />}
        </span>

        <span className={s.runTitles}>
          <span className={s.runWhen}>{when(record)}</span>
          <span className={s.runMeta}>
            {many} {many === 1 ? 'programa' : 'programas'} · disco {record.drive} ·{' '}
            {howLong(runSeconds(record))}
          </span>
        </span>

        <span className={s.runPills}>
          {tallyOf(record).map((one) => (
            <span key={one.state} className={s.runPill} data-state={one.state}>
              {one.count} {one.count === 1 ? RUN_STATE_ONE[one.state] : RUN_STATE_LABEL[one.state]}
            </span>
          ))}
        </span>
      </button>

      {open && (
        <div className={s.runBody}>
          {record.items.map((item) => {
            const program = catalog.byId.get(item.id)
            const state = RUN_STATES.find((one) => one === item.status)

            return (
              <div key={item.id} className={s.runItem}>
                <div className={s.runLine}>
                  {program ? (
                    <AppIcon id={program.id} name={program.name} size={26} />
                  ) : (
                    <span className={shell.stranger}>—</span>
                  )}

                  <span className={s.runName}>{program?.name ?? item.id}</span>
                  <span className={s.runDisk}>disco {item.drive}</span>
                  <span className={s.runTag} data-state={state ?? 'canceled'}>
                    {state ? RUN_STATE_ONE[state].toUpperCase() : item.status.toUpperCase()}
                  </span>
                </div>

                {item.error && <div className={s.runError}>{item.error}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function HistoryTab() {
  const { records, clear } = useHistory()

  if (records === null) return <p className={shell.empty}>Lendo as filas que já rodaram…</p>

  if (records.length === 0) {
    return (
      <p className={shell.empty}>
        Nenhuma fila terminou ainda neste PC. Quando a primeira terminar, ela aparece aqui.
      </p>
    )
  }

  return (
    <>
      <div className={s.histTop}>
        <p className={s.histLine}>
          {records.length === 1
            ? 'A última fila que rodou neste PC.'
            : `As ${records.length} filas mais recentes deste PC.`}{' '}
          O Pulse guarda as {HISTORY_LIMIT} últimas.
        </p>

        <span className={shell.actions}>
          <button type="button" className={shell.action} data-tone="danger" onClick={clear}>
            LIMPAR O HISTÓRICO
          </button>
        </span>
      </div>

      <div className={s.runs}>
        {records.map((record, index) => (
          <Run key={`${record.finishedAt}-${index}`} record={record} index={index} />
        ))}
      </div>
    </>
  )
}
