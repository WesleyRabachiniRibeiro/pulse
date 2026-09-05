import { useEffect, useState } from 'react'
import { formatMb, PROGRAM_BY_ID } from '@shared/domain/catalog'
import {
  anyNeedsRestart,
  driveLabel,
  elapsedSeconds,
  groupSummary,
  tally,
  type Run,
} from '@shared/domain/installation'
import { SECONDS_UNTIL_RESTART } from '@shared/domain/system'
import { bridge } from '@/shared/lib/bridge'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { ClampedText } from '@/shared/ui/ClampedText/ClampedText'
import { useRun } from '@/features/installation'
import s from './Summary.module.css'

interface Props {
  onChooseMore: () => void
  onSeeInstallation: () => void
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function headline(run: Run): string {
  const { done, failed, canceled } = tally(run.items)
  if (done === 0) return 'Nada foi instalado.'
  if (failed > 0)
    return `${plural(done, 'programa pronto', 'programas prontos')}, ${plural(failed, 'ficou', 'ficaram')} de fora`
  if (canceled > 0) return `${plural(done, 'programa pronto', 'programas prontos')}.`
  return 'Tudo instalado.'
}

function duration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  return `${Math.max(1, Math.round(seconds / 60))} min`
}

export function Summary({ onChooseMore, onSeeInstallation }: Props) {
  const run = useRun()
  const [restarting, setRestarting] = useState(false)
  const [left, setLeft] = useState(SECONDS_UNTIL_RESTART)

  useEffect(() => {
    if (!restarting) return
    setLeft(SECONDS_UNTIL_RESTART)
    const t = setInterval(() => setLeft((r) => Math.max(0, r - 1)), 1000)
    return () => clearInterval(t)
  }, [restarting])

  if (!run) {
    return (
      <div className={s.screen}>
        <div className={s.eyebrow}>RESUMO</div>
        <h2 className={s.headline}>Ainda não há o que resumir.</h2>
        <p className={s.subtitle}>
          Escolha os programas e instale: o resultado de cada um aparece aqui no fim.
        </p>
        <div className={s.actions}>
          <button type="button" className={s.primary} onClick={onChooseMore}>
            Escolher programas
          </button>
        </div>
      </div>
    )
  }

  const groups = groupSummary(run.items)
  const { done } = tally(run.items)
  const ready = run.items.filter((i) => i.status === 'done')
  const installedMb = ready.reduce((t, i) => t + (PROGRAM_BY_ID.get(i.id)?.mb ?? 0), 0)
  const hasRestart = anyNeedsRestart(run.items)

  const byDrive = [
    ...ready
      .reduce((map, i) => {
        const mb = PROGRAM_BY_ID.get(i.id)?.mb ?? 0
        return map.set(i.drive, (map.get(i.drive) ?? 0) + mb)
      }, new Map<string, number>())
      .entries(),
  ].sort(([a], [b]) => a.localeCompare(b))

  function restart() {
    setRestarting(true)
    void bridge.invoke('system:restart', undefined)
  }

  function giveUp() {
    setRestarting(false)
    void bridge.invoke('system:cancelRestart', undefined)
  }

  return (
    <div className={s.screen}>
      <div className={s.eyebrow}>RESUMO</div>
      <h2 className={s.headline}>{headline(run)}</h2>
      <p className={s.subtitle}>
        {done > 0
          ? `${plural(done, 'programa', 'programas')} em ${duration(elapsedSeconds(run))}, ${formatMb(installedMb)} no disco ${run.drive}.`
          : `Nenhum programa entrou no disco ${run.drive}.`}
      </p>

      <dl className={s.score}>
        <div className={s.scoreItem}>
          <dt>programas prontos</dt>
          <dd>
            {done} de {run.items.length}
          </dd>
        </div>
        <div className={s.scoreItem}>
          <dt>tempo total</dt>
          <dd>{duration(elapsedSeconds(run))}</dd>
        </div>
        <div className={s.scoreItem}>
          <dt>baixado</dt>
          <dd>{formatMb(installedMb)}</dd>
        </div>
        {byDrive.map(([drive, mb]) => (
          <div key={drive} className={s.scoreItem}>
            <dt>no disco {drive}</dt>
            <dd>{formatMb(mb)}</dd>
          </div>
        ))}
      </dl>

      <div className={s.groups}>
        {groups.map((group) => (
          <section key={group.kind} className={s.group} data-kind={group.kind}>
            <header className={s.header}>
              <span className={s.dot} data-kind={group.kind} aria-hidden />
              <h3 className={s.title}>{group.title}</h3>
              <span className={s.amount}>
                {group.lines.length} {group.lines.length === 1 ? 'programa' : 'programas'}
              </span>
            </header>

            {group.kind === 'attention' && (
              <p className={s.explanation}>
                Estes não entraram. O motivo de cada um está abaixo, do jeito que o instalador
                contou.
              </p>
            )}
            {group.kind === 'restart' && (
              <p className={s.explanation}>
                Estes já estão no disco, mas só funcionam depois que o computador reiniciar.
              </p>
            )}

            <div className={s.rows}>
              {group.lines.map((line) => {
                const program = PROGRAM_BY_ID.get(line.id)
                const name = program?.name ?? line.id
                return (
                  <div key={line.id} className={s.row} data-kind={group.kind}>
                    <div className={s.main}>
                      <AppIcon id={line.id} name={name} size={32} />

                      <div className={s.identity}>
                        <div className={s.rowName}>
                          <span className={s.name}>{name}</span>
                          {program && <span className={s.version}>{program.version}</span>}
                          <span className={s.drive} data-general={line.drive === run.drive}>
                            {driveLabel(line.drive, run.drive)}
                          </span>
                        </div>

                        <ClampedText text={line.note} className={s.note} />
                      </div>
                    </div>

                    <div className={s.details}>
                      {program && <span>{formatMb(program.mb)}</span>}
                      {line.duration !== null && <span>levou {duration(line.duration)}</span>}
                      {line.driveIgnored && (
                        <span className={s.alert}>o instalador ignorou o disco escolhido</span>
                      )}
                      {line.extras.map((extra) => (
                        <span key={extra} className={s.extra}>
                          {extra}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {hasRestart && !restarting && (
        <p className={s.restartNotice}>
          Alguns programas só terminam depois que o computador reinicia. Dá para deixar para
          depois: nada se perde.
        </p>
      )}

      {restarting && (
        <div className={s.countdown}>
          <span className={s.countdownText}>
            O computador reinicia em {left} s. Salve o que estiver aberto.
          </span>
          <button type="button" className={s.secondary} onClick={giveUp}>
            Cancelar reinício
          </button>
        </div>
      )}

      <div className={s.actions}>
        {hasRestart && !restarting && (
          <button type="button" className={s.primary} onClick={restart}>
            Reiniciar agora
          </button>
        )}

        <button
          type="button"
          className={hasRestart ? s.secondary : s.primary}
          onClick={onChooseMore}
        >
          Instalar mais coisas
        </button>

        <button type="button" className={s.quiet} onClick={onSeeInstallation}>
          Ver detalhes da instalação
        </button>
      </div>
    </div>
  )
}
