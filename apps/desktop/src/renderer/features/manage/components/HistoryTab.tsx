import { RUN_STATE_LABEL, RUN_STATE_ONE } from '@pulse/domain'
import { clock } from '@pulse/domain'
import { installedCount, runSeconds, tallyOf } from '@pulse/utils'
import { useHistory } from '../store/useHistory'
import { useCatalog } from '@/features/catalog'
import s from './Manage.module.css'

const WHEN = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function when(iso: string): string {
  const at = Date.parse(iso)
  return Number.isNaN(at) ? 'data desconhecida' : WHEN.format(at)
}

export function HistoryTab() {
  const catalog = useCatalog()
  const { records, clear } = useHistory()

  if (records === null) return <p className={s.empty}>Lendo o histórico…</p>

  if (records.length === 0) {
    return (
      <p className={s.empty}>
        Nada por aqui ainda. Cada fila que você terminar aparece nesta lista, com o que entrou e o
        que ficou pelo caminho.
      </p>
    )
  }

  return (
    <div className={s.list}>
      <div className={s.listTop}>
        <span className={s.listCount}>
          {records.length} {records.length === 1 ? 'instalação' : 'instalações'}
        </span>
        <button type="button" className={s.ghost} onClick={clear}>
          LIMPAR O HISTÓRICO
        </button>
      </div>

      {records.map((record) => {
        const counts = tallyOf(record)
        const ready = installedCount(record)

        return (
          <article key={record.startedAt} className={s.record}>
            <div className={s.recordTop}>
              <span className={s.when}>{when(record.startedAt)}</span>
              <span className={s.meta}>
                disco {record.drive} · {clock(runSeconds(record))}
              </span>
            </div>

            <div className={s.counts}>
              {counts.map(({ state, count }) => (
                <span key={state} className={s.count} data-state={state}>
                  {count} {count === 1 ? RUN_STATE_ONE[state] : RUN_STATE_LABEL[state]}
                </span>
              ))}
            </div>

            <p className={s.names}>
              {record.items
                .filter((item) => item.status === 'done')
                .map((item) => catalog.byId.get(item.id)?.name ?? item.id)
                .join(', ') || 'nenhum programa entrou'}
            </p>

            {ready < record.items.length && (
              <ul className={s.problems}>
                {record.items
                  .filter((item) => item.status !== 'done')
                  .map((item) => (
                    <li key={item.id} className={s.problem}>
                      <span className={s.problemName}>
                        {catalog.byId.get(item.id)?.name ?? item.id}
                      </span>
                      <span className={s.problemWhy}>
                        {item.error ?? RUN_STATE_ONE[item.status as 'failed'] ?? item.status}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </article>
        )
      })}
    </div>
  )
}
