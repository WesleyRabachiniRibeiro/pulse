import { CHECK_ORDER, type Check, type CheckId } from '@pulse/domain'
import { chooseDrive, reloadPreflight, usePreflightBusy, usePreflightState } from '../store/usePreflight'
import { CheckCard, CheckCardSkeleton } from './CheckCard'
import { DrivePicker, DrivePickerSkeleton } from './DrivePicker'
import s from './Welcome.module.css'

interface Props {
  onNext: () => void
  queueOn?: string | null
}

const CHECK_LABELS: Record<CheckId, string> = {
  windows: 'Versão do Windows',
  admin: 'Permissão de administrador',
  winget: 'Instalador do Windows',
  internet: 'Conexão com a internet',
  drive: 'Espaço livre',
  virtualization: 'Virtualização',
}

function countOf(checks: readonly Check[], status: Check['status']): number {
  return checks.filter((c) => c.status === status).length
}

export function Welcome({ onNext, queueOn }: Props) {
  const state = usePreflightState()
  const verificando = usePreflightBusy()

  const cleared = state.phase === 'ready' && state.data.overall !== 'blocker'

  const summary = (() => {
    switch (state.phase) {
      case 'drives':
        return 'PROCURANDO OS DISCOS…'
      case 'choosing':
        return 'ESCOLHA UM DISCO PARA COMEÇAR A VERIFICAÇÃO'
      case 'checking':
        return 'VERIFICANDO O SEU SISTEMA…'
      case 'error':
        return 'RESOLVA O ERRO ACIMA PARA CONTINUAR'
      case 'ready': {
        const blockers = countOf(state.data.checks, 'blocker')
        if (blockers > 0) {
          const nome = blockers === 1 ? 'IMPEDIMENTO' : 'IMPEDIMENTOS'
          return `${blockers} ${nome} · RESOLVA PARA CONTINUAR`
        }
        const warnings = countOf(state.data.checks, 'warning')
        if (warnings > 0) {
          const nome = warnings === 1 ? 'ATENÇÃO' : 'ATENÇÕES'
          return `${warnings} ${nome} · NÃO IMPEDE A INSTALAÇÃO`
        }
        return 'TUDO CERTO · NADA É INSTALADO ANTES DE VOCÊ CONFIRMAR'
      }
    }
  })()

  const alert =
    state.phase === 'choosing' || (state.phase === 'ready' && state.data.overall !== 'ok')

  return (
    <div className={s.screen}>
      <header className={s.top}>
        <div className={s.step}>PASSO 01</div>
        <h2 className={s.title}>Olhando o seu computador</h2>
      </header>

      <div className={s.body}>
        {state.phase === 'error' ? (
          <div className={s.error}>
            <div className={s.errorTitle}>Não deu para verificar o seu sistema.</div>
            <div className={s.errorDetail}>{state.message}</div>
          </div>
        ) : state.phase === 'checking' || state.phase === 'ready' ? (
          <div className={s.checks} data-tour="checks">
            {CHECK_ORDER.map((id) => {
              const found =
                state.phase === 'ready'
                  ? state.data.checks.find((c) => c.id === id)
                  : state.partialChecks.find((c) => c.id === id)

              return found ? (
                <CheckCard key={id} check={found} />
              ) : (
                <CheckCardSkeleton key={id} label={CHECK_LABELS[id]} />
              )
            })}
          </div>
        ) : null}

        {state.phase === 'drives' && <DrivePickerSkeleton />}

        {state.phase !== 'drives' && state.phase !== 'error' && (
          <DrivePicker
            drives={state.phase === 'ready' ? state.data.drives : state.drives}
            chosen={
              state.phase === 'ready'
                ? state.data.chosenDrive
                : state.phase === 'checking'
                  ? state.chosen
                  : null
            }
            onChoose={chooseDrive}
            disabled={state.phase === 'checking'}
          />
        )}

        {queueOn && (
          <p className={s.queueNotice}>
            Já existe uma instalação em andamento no disco {queueOn}. Ela continua lá até o fim;
            trocar de disco aqui vale para o que você mandar instalar depois.
          </p>
        )}
      </div>

      <footer className={s.footer}>
        <span className={`${s.summary} ${alert ? s.summaryAlert : ''}`}>{summary}</span>

        <div className={s.actions}>
          <button
            type="button"
            className={s.secondary}
            onClick={() => void reloadPreflight(true)}
            disabled={verificando}
          >
            Verificar de novo
          </button>

          <button type="button" className={s.primary} onClick={onNext} disabled={!cleared}>
            Escolher programas
          </button>
        </div>
      </footer>
    </div>
  )
}
