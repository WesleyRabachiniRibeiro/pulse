import { useState } from 'react'
import { LuExternalLink } from 'react-icons/lu'
import type { PinPurpose } from '@shared/domain/parental'
import { bridge } from '@/shared/lib/bridge'
import { applyParental, useParental } from '../store/useParental'
import { PinDialog } from './PinDialog'
import s from './ParentalSection.module.css'

interface Props {
  onOpenBlocked: () => void
}

type Pergunta = { purpose: PinPurpose; step?: 'atual' | 'novo'; current?: string }

export function ParentalSection({ onOpenBlocked }: Props) {
  const view = useParental()
  const [asking, setAsking] = useState<Pergunta | null>(null)

  const on = view.on && view.hasPin

  async function ligar(pin: string): Promise<string | null> {
    const answer = await bridge.invoke('parental:turnOn', { pin }).catch(() => null)
    if (!answer?.ok || !answer.view) return 'Não deu para ligar com esse PIN.'

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
      setAsking({ purpose: 'change', step: 'novo', current: pin })
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

  async function abrirLista(pin: string): Promise<string | null> {
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
    if (asking.purpose === 'list') return abrirLista(pin)
    return trocar(pin, asking.current)
  }

  const blocked = view.blocked.length

  return (
    <section className={s.section}>
      <div className={s.header}>
        <span className={s.name}>CONTROLE DOS PAIS</span>
        <span className={s.line} aria-hidden />
        <span className={s.scope} data-on={on}>
          {on ? 'LIGADO · O PULSE ASSUME QUE É A CRIANÇA' : 'DESLIGADO'}
        </span>
      </div>

      <div className={s.cards}>
        <div className={s.card}>
          <div className={s.top}>
            <div className={s.texts}>
              <div className={s.cardName}>Controle dos pais</div>
              <div className={s.hint}>
                Ligado, o Pulse passa a tratar quem está na frente como a criança: o que estiver na
                sua lista não pode ser instalado, tirar programa do PC pede o PIN, e desligar
                também.
              </div>
            </div>

            <button
              type="button"
              className={on ? s.secondary : s.primary}
              onClick={() =>
                setAsking({ purpose: on ? 'turnOff' : view.hasPin ? 'turnOff' : 'create' })
              }
            >
              {on ? 'Desligar' : 'Ligar'}
            </button>
          </div>
        </div>

        {on && (
          <>
            <div className={s.warn}>
              <span className={s.warnMark} aria-hidden>
                !
              </span>
              <span className={s.warnText}>
                Isso tranca o Pulse, não o computador. Quem baixar o instalador pelo navegador ou
                rodar o winget na linha de comando passa por cima. É trava de conveniência.
              </span>
            </div>

            <div className={s.card}>
              <div className={s.top}>
                <div className={s.texts}>
                  <div className={s.cardName}>Lista de bloqueados</div>
                  <div className={s.hint}>
                    Você percorre o catálogo e marca o que ela não pode instalar. Mexer nesta lista
                    pede o PIN.
                  </div>
                  <div className={s.count}>
                    {blocked === 0
                      ? 'nada bloqueado ainda'
                      : `${blocked} ${blocked === 1 ? 'programa bloqueado' : 'programas bloqueados'}`}
                  </div>
                </div>

                <button
                  type="button"
                  className={s.secondary}
                  onClick={() => setAsking({ purpose: 'list' })}
                >
                  Abrir a lista
                </button>
              </div>
            </div>

            <div className={s.card}>
              <div className={s.top}>
                <div className={s.texts}>
                  <div className={s.cardName}>Trocar o PIN</div>
                  <div className={s.hint}>Pede o de agora e depois o novo.</div>
                </div>

                <button
                  type="button"
                  className={s.secondary}
                  onClick={() => setAsking({ purpose: 'change', step: 'atual' })}
                >
                  Trocar
                </button>
              </div>
            </div>

            <div className={s.card}>
              <div className={s.top}>
                <div className={s.texts}>
                  <div className={s.cardName}>Microsoft Family</div>
                  <div className={s.hint}>
                    Limite de tempo de tela, filtro de sites e bloqueio por classificação moram nas
                    contas do Windows. É lá que o controle de verdade é feito. O Pulse só cuida do
                    que ele mesmo instala.
                  </div>
                </div>

                <button
                  type="button"
                  className={s.secondary}
                  onClick={() => void bridge.invoke('system:openFamily', undefined)}
                >
                  Abrir contas do Windows
                  <LuExternalLink size={13} aria-hidden />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {asking && (
        <PinDialog
          purpose={asking.purpose}
          {...(asking.step === 'novo' ? { extra: 'Agora o PIN novo.' } : {})}
          onDone={responder}
          onClose={() => setAsking(null)}
        />
      )}
    </section>
  )
}
