import { useEffect, useLayoutEffect, useState } from 'react'
import { useTour } from '../store/useTour'
import { PASSOS } from './passos'
import s from './Tour.module.css'

interface Caixa {
  top: number
  left: number
  width: number
  height: number
}

const FOLGA = 8

function medir(seletor: string | null, rolar = false): Caixa | null {
  if (!seletor) return null
  const el = document.querySelector(seletor)
  if (!el) return null
  if (rolar) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' })
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return {
    top: r.top - FOLGA,
    left: r.left - FOLGA,
    width: r.width + FOLGA * 2,
    height: r.height + FOLGA * 2,
  }
}

function posicionar(caixa: Caixa | null): { top: number; left: number } {
  const largura = 330
  const altura = 250
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (!caixa) {
    return { top: Math.max(16, vh / 2 - altura / 2), left: Math.max(16, vw / 2 - largura / 2) }
  }

  const aDireita = caixa.left + caixa.width / 2 < vw / 2
  const left = aDireita
    ? Math.min(caixa.left + caixa.width + 16, vw - largura - 16)
    : Math.max(16, caixa.left - largura - 16)
  const top = Math.min(Math.max(16, caixa.top), vh - altura - 16)
  return { top, left }
}

export function Tour() {
  const { aberto, passo, contexto, fechar, ir, pedirTela } = useTour()
  const [caixa, setCaixa] = useState<Caixa | null>(null)

  const atual = PASSOS[passo] ?? PASSOS[0]!
  const ultimo = passo === PASSOS.length - 1

  useEffect(() => {
    if (!aberto || !atual.tela) return
    pedirTela(atual.tela)
  }, [aberto, atual, pedirTela])

  useLayoutEffect(() => {
    if (!aberto) return
    let cancelado = false
    const relogios: number[] = []

    const tentar = (tentativa: number) => {
      if (cancelado) return
      const achou = medir(atual.alvo, true)
      setCaixa(achou)
      if (!achou && atual.alvo && tentativa < 8) {
        relogios.push(window.setTimeout(() => tentar(tentativa + 1), 120))
        return
      }
      relogios.push(
        window.setTimeout(() => {
          if (!cancelado) setCaixa(medir(atual.alvo))
        }, 380),
      )
    }

    tentar(0)
    const atualizar = () => setCaixa(medir(atual.alvo))
    window.addEventListener('resize', atualizar)
    return () => {
      cancelado = true
      for (const r of relogios) clearTimeout(r)
      window.removeEventListener('resize', atualizar)
    }
  }, [aberto, atual])

  useEffect(() => {
    if (!aberto || !atual.esperar || atual.esperar !== contexto) return
    const t = setTimeout(() => ir(passo + 1), 260)
    return () => clearTimeout(t)
  }, [aberto, atual, contexto, passo, ir])

  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar()
      if (e.key === 'ArrowRight') ir(Math.min(PASSOS.length - 1, passo + 1))
      if (e.key === 'ArrowLeft') ir(Math.max(0, passo - 1))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberto, passo, fechar, ir])

  if (!aberto) return null

  const cartao = posicionar(caixa)

  return (
    <div className={s.camada} role="dialog" aria-modal="true" aria-label="Como o Pulse funciona">
      {caixa ? (
        <div
          className={s.holofote}
          style={{ top: caixa.top, left: caixa.left, width: caixa.width, height: caixa.height }}
        />
      ) : (
        <div className={s.centro} />
      )}

      <div className={s.cartao} style={{ top: cartao.top, left: cartao.left }}>
        <div className={s.contador}>
          {passo + 1} DE {PASSOS.length}
        </div>
        <h2 className={s.titulo}>{atual.titulo}</h2>
        <p className={s.texto}>{atual.texto}</p>

        <div className={s.pontos}>
          {PASSOS.map((p, i) => (
            <button
              key={p.titulo}
              type="button"
              className={s.ponto}
              data-atual={i === passo}
              aria-label={`Ir para o passo ${i + 1}`}
              onClick={() => ir(i)}
            />
          ))}
        </div>

        <div className={s.acoes}>
          <button type="button" className={s.pular} onClick={fechar}>
            {ultimo ? 'fechar' : 'pular'}
          </button>

          {passo > 0 && (
            <button type="button" className={s.voltar} onClick={() => ir(passo - 1)}>
              Voltar
            </button>
          )}

          {!atual.esperar && (
            <button
              type="button"
              className={s.seguir}
              onClick={() => (ultimo ? fechar() : ir(passo + 1))}
            >
              {ultimo ? 'Entendi' : 'Próximo'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
