import { useEffect } from 'react'
import { usePreflight } from '../hooks/usePreflight'
import { CheckCard, CheckCardSkeleton } from './CheckCard'
import { DrivePicker, DrivePickerSkeleton } from './DrivePicker'
import s from './Welcome.module.css'

interface Props {
  onNext: () => void
  onDriveReady: (drive: string | null) => void
  currentDrive?: string
  queueOn?: string | null
}

const EXPECTED_CHECKS = 6

export function Welcome({ onNext, onDriveReady, currentDrive, queueOn }: Props) {
  const { state, chooseDrive } = usePreflight(currentDrive)

  const cleared = state.phase === 'ready' && state.data.overall !== 'blocker'

  const note = (() => {
    switch (state.phase) {
      case 'drives':
        return 'procurando os discos…'
      case 'choosing':
        return 'escolha um disco para começar a verificação'
      case 'checking':
        return 'verificando o seu sistema…'
      case 'error':
        return 'resolva o erro acima para continuar'
      case 'ready':
        return state.data.overall === 'blocker'
          ? 'resolva os itens marcados para continuar'
          : 'nada é instalado antes de você confirmar'
    }
  })()

  const alert = state.phase === 'choosing' || (state.phase === 'ready' && state.data.overall === 'blocker')

  const result =
    state.phase === 'ready'
      ? cleared
        ? state.data.chosenDrive
        : null
      : state.phase === 'error'
        ? null
        : undefined

  useEffect(() => {
    if (result !== undefined) onDriveReady(result)
  }, [result, onDriveReady])

  return (
    <div className={s.screen}>
      <div className={s.eyebrow}>VERIFICAÇÃO</div>

      <h1 className={s.title}>
        Antes de instalar, <span className={s.highlight}>uma conferida</span>.
      </h1>

      <p className={s.subtitle}>
        Escolha o disco e o Pulse confere se este computador tem o que precisa. Nada é instalado
        antes de você passar por aqui.
      </p>

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

      {state.phase === 'error' ? (
        <div className={s.error}>
          <div className={s.errorTitle}>Não deu para verificar o seu sistema.</div>
          <div className={s.errorDetail}>{state.message}</div>
        </div>
      ) : state.phase === 'checking' || state.phase === 'ready' ? (
        <div className={s.grid} data-tour="checks">
          {state.phase === 'ready'
            ? state.data.checks.map((c) => <CheckCard key={c.id} check={c} />)
            : Array.from({ length: EXPECTED_CHECKS }, (_, i) => <CheckCardSkeleton key={i} />)}
        </div>
      ) : null}

      <div className={s.actions}>
        <button className={s.primary} onClick={onNext} disabled={!cleared}>
          Escolher programas
        </button>

        <span className={`${s.note} ${alert ? s.noteBlocker : ''}`}>{note}</span>
      </div>
    </div>
  )
}
