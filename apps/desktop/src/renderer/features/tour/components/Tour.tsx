import { useEffect, useLayoutEffect, useState } from 'react'
import { useTour } from '../store/useTour'
import { STEPS } from './steps'
import s from './Tour.module.css'

interface Box {
  top: number
  left: number
  width: number
  height: number
}

const GAP = 8

function measure(selector: string | null, scroll = false): Box | null {
  if (!selector) return null
  const el = document.querySelector(selector)
  if (!el) return null
  if (scroll) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' })
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return {
    top: r.top - GAP,
    left: r.left - GAP,
    width: r.width + GAP * 2,
    height: r.height + GAP * 2,
  }
}

function position(box: Box | null): { top: number; left: number } {
  const cardWidth = 330
  const cardHeight = 250
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (!box) {
    return { top: Math.max(16, vh / 2 - cardHeight / 2), left: Math.max(16, vw / 2 - cardWidth / 2) }
  }

  const onRight = box.left + box.width / 2 < vw / 2
  const left = onRight
    ? Math.min(box.left + box.width + 16, vw - cardWidth - 16)
    : Math.max(16, box.left - cardWidth - 16)
  const top = Math.min(Math.max(16, box.top), vh - cardHeight - 16)
  return { top, left }
}

export function Tour() {
  const { open, step, context, close, go, requestScreen } = useTour()
  const [box, setBox] = useState<Box | null>(null)

  const current = STEPS[step] ?? STEPS[0]!
  const isLast = step === STEPS.length - 1

  useEffect(() => {
    if (!open || !current.screen) return
    requestScreen(current.screen)
  }, [open, current, requestScreen])

  useLayoutEffect(() => {
    if (!open) return
    let canceled = false
    const timers: number[] = []

    const attempt = (attemptNumber: number) => {
      if (canceled) return
      const found = measure(current.target, true)
      setBox(found)
      if (!found && current.target && attemptNumber < 8) {
        timers.push(window.setTimeout(() => attempt(attemptNumber + 1), 120))
        return
      }
      timers.push(
        window.setTimeout(() => {
          if (!canceled) setBox(measure(current.target))
        }, 380),
      )
    }

    attempt(0)
    const update = () => setBox(measure(current.target))
    window.addEventListener('resize', update)
    return () => {
      canceled = true
      for (const t of timers) clearTimeout(t)
      window.removeEventListener('resize', update)
    }
  }, [open, current])

  useEffect(() => {
    if (!open || !current.waitFor || current.waitFor !== context) return
    const t = setTimeout(() => go(step + 1), 260)
    return () => clearTimeout(t)
  }, [open, current, context, step, go])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') go(Math.min(STEPS.length - 1, step + 1))
      if (e.key === 'ArrowLeft') go(Math.max(0, step - 1))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, step, close, go])

  if (!open) return null

  const card = position(box)

  return (
    <div className={s.camada} role="dialog" aria-modal="true" aria-label="Como o Pulse funciona">
      {box ? (
        <div
          className={s.holofote}
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      ) : (
        <div className={s.centro} />
      )}

      <div className={s.cartao} style={{ top: card.top, left: card.left }}>
        <div className={s.contador}>
          {step + 1} DE {STEPS.length}
        </div>
        <h2 className={s.titulo}>{current.title}</h2>
        <p className={s.texto}>{current.text}</p>

        <div className={s.pontos}>
          {STEPS.map((p, i) => (
            <button
              key={p.title}
              type="button"
              className={s.ponto}
              data-atual={i === step}
              aria-label={`Ir para o passo ${i + 1}`}
              onClick={() => go(i)}
            />
          ))}
        </div>

        <div className={s.acoes}>
          <button type="button" className={s.pular} onClick={close}>
            {isLast ? 'fechar' : 'pular'}
          </button>

          {step > 0 && (
            <button type="button" className={s.voltar} onClick={() => go(step - 1)}>
              Voltar
            </button>
          )}

          {!current.waitFor && (
            <button
              type="button"
              className={s.seguir}
              onClick={() => (isLast ? close() : go(step + 1))}
            >
              {isLast ? 'Entendi' : 'Próximo'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
