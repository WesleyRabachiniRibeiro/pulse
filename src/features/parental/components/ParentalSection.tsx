import { useState } from 'react'
import { LuExternalLink } from 'react-icons/lu'
import type { PinPurpose } from '@shared/domain/parental'
import { usePrograms } from '@/features/catalog'
import { bridge } from '@/shared/lib/bridge'
import { applyParental, useParental } from '../store/useParental'
import { PinDialog } from './PinDialog'
import s from './ParentalSection.module.css'

interface Props {
  onOpenBlocked: () => void
}

interface Pergunta {
  purpose: PinPurpose
  step: 'unico' | 'atual' | 'novo'
  current?: string
  extra?: string
}

export function ParentalSection({ onOpenBlocked }: Props) {
  const view = useParental()
  const programs = usePrograms()
  const [asking, setAsking] = useState<Pergunta | null>(null)

  const on = view.on && view.hasPin

  async function ligar(pin: string): Promise<string | null> {
    const answer = await bridge.invoke('parental:turnOn', { pin }).catch(() => null)
    if (!answer?.ok || !answer.view) {
      return view.hasPin ? 'PIN incorreto.' : 'Não deu para ligar com esse PIN.'
    }

    applyParental(answer.view)
    setAsking(null)
    return null
  }

  async function desligar(pin: string): Promise<string | null> {
    const answer = await bridge.invoke('parental:turnOff', { pin }).catch(() => null)
    if (!answer?.ok || !answer.view) return 'PIN incorreto.'

    applyParental(answer.view)
    setAsking(null)
    return null
  }

  async function trocar(pin: string, atual?: string): Promise<string | null> {
    if (!atual) {
      const certo = await bridge.invoke('parental:check', { pin }).catch(() => false)
      if (!certo) return 'PIN incorreto.'

      setAsking({
        purpose: 'change',
        step: 'novo',
        current: pin,
        extra: 'Agora o PIN novo. São quatro números.',
      })
      return null
    }

    const answer = await bridge
      .invoke('parental:change', { current: atual, next: pin })
      .catch(() => null)

    if (!answer?.ok || !answer.view) return 'Não deu para trocar o PIN.'

    applyParental(answer.view)
    setAsking(null)
    return null
  }

  async function openList(pin: string): Promise<string | null> {
    const certo = await bridge.invoke('parental:check', { pin }).catch(() => false)
    if (!certo) return 'PIN incorreto.'

    setAsking(null)
    onOpenBlocked()
    return null
  }

  function responder(pin: string): Promise<string | null> {
    if (!asking) return Promise.resolve(null)

    if (asking.purpose === 'create') return ligar(pin)
    if (asking.purpose === 'turnOff') return desligar(pin)
    if (asking.purpose === 'list') return openList(pin)
    return trocar(pin, asking.current)
  }

  function chave() {
    if (on) return setAsking({ purpose: 'turnOff', step: 'unico' })

    setAsking({
      purpose: 'create',
      step: 'unico',
      ...(view.hasPin ? { extra: 'Digite o seu PIN para ligar de novo.' } : {}),
    })
  }

  const blocked = view.blocked.length
  const blockLine =
    blocked === 0
      ? 'nada bloqueado ainda'
      : `${blocked} de ${programs.length} programas bloqueados para a criança`

  return (
    <section className={s.section}>
      <div className={s.header}>
        <span className={s.name}>CONTROLE DOS PAIS</span>
        <span className={s.line} aria-hidden />
        <span className={s.state} data-on={on}>
          {on ? 'LIGADO · O PULSE ASSUME QUE É A CRIANÇA' : 'DESLIGADO'}
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

          <button type="button" className={s.action} onClick={chave}>
            {on ? 'Desligar' : 'Ligar'}
          </button>
        </div>

        {on && (
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
                onClick={() => setAsking({ purpose: 'list', step: 'unico' })}
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
                onClick={() => setAsking({ purpose: 'change', step: 'atual' })}
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
                onClick={() => void bridge.invoke('system:openFamily')}
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
          onDone={responder}
          onClose={() => setAsking(null)}
        />
      )}
    </section>
  )
}
