import { useState } from 'react'
import { LuExternalLink } from 'react-icons/lu'
import { type PinPurpose } from '@pulse/domain'
import { bridge } from '@/shared/lib/bridge'
import { useCatalog } from '@/features/catalog'
import {
  changeParentalPin,
  checkParentalPin,
  turnOffParental,
  turnOnParental,
  useParental,
} from '../store/useParental'
import { PinDialog } from './PinDialog'
import s from './ParentalSection.module.css'

interface Asking {
  purpose: PinPurpose
  step: 'single' | 'current' | 'next'
  current?: string
  extra?: string
}

interface Props {
  onOpenBlocked: () => void
}

export function ParentalSection({ onOpenBlocked }: Props) {
  const catalog = useCatalog()
  const { on, hasPin, blocked } = useParental()
  const [asking, setAsking] = useState<Asking | null>(null)

  const locked = on && hasPin

  async function turnOn(pin: string): Promise<string | null> {
    const ok = await turnOnParental(pin)
    if (!ok) return hasPin ? 'PIN incorreto.' : 'Não deu para ligar com esse PIN.'

    setAsking(null)
    return null
  }

  async function turnOff(pin: string): Promise<string | null> {
    const ok = await turnOffParental(pin)
    if (!ok) return 'PIN incorreto.'

    setAsking(null)
    return null
  }

  async function change(pin: string, current?: string): Promise<string | null> {
    if (!current) {
      const ok = await checkParentalPin(pin)
      if (!ok) return 'PIN incorreto.'

      setAsking({
        purpose: 'change',
        step: 'next',
        current: pin,
        extra: 'Agora o PIN novo. São quatro números.',
      })
      return null
    }

    const ok = await changeParentalPin(current, pin)
    if (!ok) return 'Não deu para trocar o PIN.'

    setAsking(null)
    return null
  }

  async function openList(pin: string): Promise<string | null> {
    const ok = await checkParentalPin(pin)
    if (!ok) return 'PIN incorreto.'

    setAsking(null)
    onOpenBlocked()
    return null
  }

  function answer(pin: string): Promise<string | null> {
    if (!asking) return Promise.resolve(null)

    if (asking.purpose === 'turnOff') return turnOff(pin)
    if (asking.purpose === 'list') return openList(pin)
    if (asking.purpose === 'change') return change(pin, asking.current)
    return turnOn(pin)
  }

  const blockLine =
    blocked.length === 0
      ? 'nada bloqueado ainda'
      : `${blocked.length} de ${catalog.programs.length} programas bloqueados para a criança`

  return (
    <section className={s.section}>
      <div className={s.header}>
        <span className={s.name}>CONTROLE DOS PAIS</span>
        <span className={s.line} aria-hidden />
        <span className={s.state} data-on={locked}>
          {locked ? 'LIGADO · O PULSE ASSUME QUE É A CRIANÇA' : 'DESLIGADO'}
        </span>
      </div>

      <div className={s.panel}>
        <div className={s.row}>
          <div className={s.texts}>
            <div className={s.rowName}>Controle dos pais</div>
            <div className={s.hint}>
              Ligado, o Pulse passa a tratar quem está na frente como a criança: o que estiver na
              sua lista não pode ser instalado, tirar programa do PC pede o PIN, e desligar também.
            </div>
          </div>

          <button
            type="button"
            className={s.action}
            onClick={() =>
              setAsking({
                purpose: locked ? 'turnOff' : hasPin ? 'turnOn' : 'create',
                step: 'single',
              })
            }
          >
            {locked ? 'Desligar' : hasPin ? 'Ligar' : 'Criar o PIN'}
          </button>
        </div>

        {locked && (
          <>
            <div className={s.warn}>
              <span className={s.warnMark} aria-hidden>
                !
              </span>
              <span className={s.warnText}>
                Isso tranca o Pulse, não o computador. Quem baixar o instalador pelo navegador ou
                rodar o winget na linha de comando passa por cima. É trava de conveniência. O
                controle de verdade é a Microsoft Family, no fim desta seção.
              </span>
            </div>

            <div className={s.row}>
              <div className={s.texts}>
                <div className={s.rowName}>Lista de bloqueados</div>
                <div className={s.hint}>
                  Você percorre o catálogo e marca o que ela não pode instalar. Mexer nesta lista
                  pede o PIN.
                </div>
                <div className={s.count}>{blockLine}</div>
              </div>

              <button
                type="button"
                className={s.amber}
                onClick={() => setAsking({ purpose: 'list', step: 'single' })}
              >
                Abrir a lista
              </button>
            </div>

            <div className={s.row}>
              <div className={s.texts}>
                <div className={s.rowName}>Trocar o PIN</div>
                <div className={s.hint}>Pede o de agora e depois o novo.</div>
              </div>

              <button
                type="button"
                className={s.quiet}
                onClick={() => setAsking({ purpose: 'change', step: 'current' })}
              >
                Trocar
              </button>
            </div>

            <div className={s.row} data-last="true">
              <div className={s.texts}>
                <div className={s.rowName}>Microsoft Family</div>
                <div className={s.hint}>
                  Limite de tempo de tela, filtro de sites e bloqueio por classificação moram nas
                  contas do Windows. É lá que o controle de verdade é feito. O Pulse só cuida do
                  que ele mesmo instala.
                </div>
              </div>

              <button
                type="button"
                className={s.primary}
                onClick={() => void bridge.invoke('system:openFamily', undefined)}
              >
                Abrir contas do Windows
                <LuExternalLink size={13} aria-hidden />
              </button>
            </div>
          </>
        )}
      </div>

      {asking && (
        <PinDialog
          key={`${asking.purpose}-${asking.step}`}
          purpose={asking.purpose}
          {...(asking.extra ? { extra: asking.extra } : {})}
          onDone={answer}
          onClose={() => setAsking(null)}
        />
      )}
    </section>
  )
}
