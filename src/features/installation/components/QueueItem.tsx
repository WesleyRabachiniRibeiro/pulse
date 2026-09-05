import { PROGRAM_BY_ID } from '@shared/domain/catalog'
import {
  canCancel,
  driveLabel,
  isActive,
  isWaiting,
  type Item,
  type ItemStatus,
} from '@shared/domain/installation'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { ClampedText } from '@/shared/ui/ClampedText/ClampedText'
import { Stages } from './Stages'
import s from './QueueItem.module.css'

const TAG: Record<ItemStatus, string> = {
  queued: 'NA FILA',
  downloading: 'BAIXANDO',
  installing: 'INSTALANDO',
  configuring: 'AJUSTANDO',
  waiting: 'PRECISA DE VOCÊ',
  done: 'CONCLUÍDO',
  failed: 'FALHOU',
  canceled: 'CANCELADO',
}

interface Props {
  item: Item
  generalDrive: string
  onRetry: (id: string) => void
  onCancel: (id: string) => void
}

export function QueueItem({ item, generalDrive, onRetry, onCancel }: Props) {
  const program = PROGRAM_BY_ID.get(item.id)
  const name = program?.name ?? item.id
  const canRetry = item.status === 'failed' || item.status === 'canceled'

  return (
    <div className={s.card} data-status={item.status}>
      <div className={s.row}>
        <AppIcon id={item.id} name={name} size={32} />

        <div className={s.body}>
          <div className={s.header}>
            <span className={s.name}>{name}</span>
            {program && <span className={s.version}>{program.version}</span>}
            <span className={s.drive} data-general={item.drive === generalDrive}>
              {driveLabel(item.drive, generalDrive)}
            </span>
          </div>
          <div className={s.detail}>
            {item.detail}
            {isActive(item) && item.percent > 0 ? ` · ${item.percent}%` : ''}
          </div>
        </div>

        <span className={s.tag}>{TAG[item.status]}</span>

        {canCancel(item) && (
          <button
            type="button"
            className={s.cancel}
            onClick={() => onCancel(item.id)}
            disabled={item.canceling}
            aria-label={`Cancelar ${name}`}
          >
            {item.canceling ? 'Cancelando…' : 'Cancelar'}
          </button>
        )}
      </div>

      {(isActive(item) || isWaiting(item)) && (
        <>
          {isActive(item) && (
            <div className={s.track}>
              {item.percent > 0 ? (
                <div className={s.bar} style={{ width: `${item.percent}%` }} />
              ) : (
                <div className={s.indeterminateBar} />
              )}
            </div>
          )}
          <Stages item={item} />
        </>
      )}

      {isWaiting(item) && (
        <div className={s.wait}>
          <span className={s.waitText}>
            Este item só continua depois que você resolver isso na janela da Steam. Os outros
            programas da fila seguem instalando normalmente.
          </span>
        </div>
      )}

      {item.driveIgnored && (
        <p className={s.notice}>
          O instalador deste programa não aceita escolha de disco. Foi para o disco do sistema.
        </p>
      )}

      {canRetry && (
        <div className={s.problem}>
          <ClampedText text={item.error ?? 'Ficou de fora da instalação.'} className={s.message} />
          <button type="button" className={s.retry} onClick={() => onRetry(item.id)}>
            Tentar de novo
          </button>
        </div>
      )}
    </div>
  )
}
