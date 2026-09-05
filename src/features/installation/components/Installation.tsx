import { useEffect, useRef, useState } from 'react'
import { PROGRAM_BY_ID } from '@shared/domain/catalog'
import {
  anyoneWaiting,
  clock,
  isActive,
  isFinished,
  isWaiting,
  itemPercent,
  overallPercent,
  PARALLEL_LIMIT,
  remainingMinutes,
  tally,
  type Run,
} from '@shared/domain/installation'
import { useInstallation } from '../hooks/useInstallation'
import { QueueItem } from './QueueItem'
import s from './Installation.module.css'

interface Props {
  onChooseMore: () => void
  onSeeSummary: () => void
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function headline(run: Run): string {
  const { done, failed, canceled, remaining } = tally(run.items)

  if (run.canceling) return 'Encerrando o que estava rodando…'
  if (anyoneWaiting(run.items)) return 'A Steam está esperando você'
  if (!run.finishedAt) return `Instalando ${plural(remaining, 'programa', 'programas')}`
  if (failed > 0) {
    return `${plural(done, 'programa pronto', 'programas prontos')}, ${plural(failed, 'ficou', 'ficaram')} de fora`
  }
  if (canceled > 0 && done === 0) return 'Instalação cancelada.'
  return 'Terminamos.'
}

function phase(run: Run): string {
  if (run.canceling) return 'CANCELANDO'
  if (anyoneWaiting(run.items)) return 'PRECISA DE VOCÊ'
  return run.finishedAt ? 'INSTALAÇÃO ENCERRADA' : 'INSTALANDO'
}

export function Installation({ onChooseMore, onSeeSummary }: Props) {
  const { run, running, elapsed, cancel, cancelItem, retry } = useInstallation()
  const [showLog, setShowLog] = useState(false)
  const logEnd = useRef<HTMLDivElement>(null)

  const lines = run?.log.length ?? 0
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' })
  }, [lines, showLog])

  if (!run) {
    return (
      <div className={s.screen}>
        <div className={s.preparing}>
          Nenhuma instalação em andamento. Volte para a seleção e escolha os programas.
        </div>
      </div>
    )
  }

  const percent = overallPercent(run.items)
  const { total, done, failed } = tally(run.items)
  const active = run.items.filter(isActive).length

  const groups = [
    {
      title: 'ACONTECENDO AGORA',
      items: run.items.filter((i) => isActive(i) || isWaiting(i)),
    },
    { title: 'ESPERANDO A VEZ', items: run.items.filter((i) => i.status === 'queued') },
    { title: 'JÁ RESOLVIDOS', items: run.items.filter(isFinished) },
  ].filter((g) => g.items.length > 0)

  return (
    <div className={s.screen}>
      <div className={s.top}>
        <div className={s.titles}>
          <div className={s.phase}>{phase(run)}</div>
          <h2 className={s.headline}>{headline(run)}</h2>
        </div>

        <div className={s.numbers}>
          <div className={s.pct}>{percent}%</div>
          <div className={s.count}>
            {done} de {total} programas
          </div>
        </div>

        {}
        <button
          type="button"
          className={s.morePrograms}
          onClick={onChooseMore}
          aria-label="Instalar outras coisas"
          title="Instalar outras coisas"
        >
          ⋯
        </button>
      </div>

      {}
      <div className={s.ribbon}>
        {run.items.map((item) => {
          const program = PROGRAM_BY_ID.get(item.id)
          return (
            <div
              key={item.id}
              className={s.stripe}
              data-status={item.status}
              style={{ flexGrow: program?.mb ?? 100 }}
              title={program?.name ?? item.id}
            >
              <div className={s.stripeFill} style={{ width: `${itemPercent(item)}%` }} />
              <span className={s.stripeName}>{program?.name.split(' ')[0] ?? item.id}</span>
            </div>
          )
        })}
      </div>

      <div className={s.middle}>
        {
}
        <div className={s.queue}>
          {groups.map((group) => (
            <section key={group.title} className={s.group}>
              <div className={s.groupHeader}>
                <span className={s.groupTitle}>{group.title}</span>
                <span className={s.groupLine} aria-hidden />
                <span className={s.groupCount}>{group.items.length}</span>
              </div>

              {group.items.map((item) => (
                <QueueItem
                  key={item.id}
                  item={item}
                  generalDrive={run.drive}
                  onRetry={retry}
                  onCancel={cancelItem}
                />
              ))}
            </section>
          ))}
        </div>

        <aside className={s.panel}>
          <div className={s.panelCard}>
            <div className={s.panelLabel}>TEMPO DECORRIDO</div>
            <div className={s.time}>{clock(elapsed)}</div>

            <div className={s.divider} />

            <div className={s.stat}>
              <span>concluídos</span>
              <span className={s.statValue}>
                {done}/{total}
              </span>
            </div>
            <div className={s.stat}>
              <span>falhas</span>
              <span className={s.statValue}>{failed}</span>
            </div>
            <div className={s.stat}>
              <span>ao mesmo tempo</span>
              <span className={s.statValue}>
                {active}/{PARALLEL_LIMIT}
              </span>
            </div>
            <div className={s.stat}>
              <span>disco geral</span>
              <span className={s.statValue}>{run.drive}</span>
            </div>
            {running && (
              <div className={s.stat}>
                <span>falta baixar</span>
                <span className={s.statValue}>~{remainingMinutes(run.items)} min</span>
              </div>
            )}
          </div>

          <p className={s.note}>
            Dá para escolher mais programas sem parar a fila: eles entram no fim dela. Alguns
            instaladores pedem a permissão do Windows, e a fila espera você responder. Se você
            pediu jogos, a Steam abre a janela dela e o item só segue depois que você confirmar.
          </p>

          {running && (
            <button
              type="button"
              className={s.cancel}
              onClick={cancel}
              disabled={run.canceling}
            >
              {run.canceling ? 'Cancelando…' : 'Cancelar tudo'}
            </button>
          )}
        </aside>
      </div>

      <div className={s.footer}>
        <div className={s.footerRow}>
          <button
            type="button"
            className={s.toggleLog}
            onClick={() => setShowLog((v) => !v)}
            aria-expanded={showLog}
          >
            {showLog ? '▾' : '▸'} DETALHES TÉCNICOS
          </button>

          <div className={s.footerActions}>
            <button
              type="button"
              className={running ? s.primary : s.secondary}
              onClick={onChooseMore}
            >
              {running ? 'Adicionar mais programas' : 'Escolher mais programas'}
            </button>

            {!running && (
              <button type="button" className={s.primary} onClick={onSeeSummary}>
                Ver resumo
              </button>
            )}
          </div>
        </div>

        {showLog && (
          <div className={s.log}>
            {run.log.map((line, i) => (
              <div key={i} className={s.logRow} data-level={line.level}>
                <span className={s.logTime}>{line.time}</span>
                <span className={s.logText}>{line.text}</span>
              </div>
            ))}
            <div ref={logEnd} />
          </div>
        )}
      </div>
    </div>
  )
}
