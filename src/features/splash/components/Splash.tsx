import { useEffect, useRef, useState } from 'react'
import { mountScene } from '../scene'
import s from './Splash.module.css'

interface Props {
  liberado: boolean
  onDone: () => void
}

export function Splash({ liberado, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [animacaoOk, setAnimacaoOk] = useState(false)
  const [saindo, setSaindo] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let dispose: (() => void) | undefined
    try {
      dispose = mountScene(canvas, () => setAnimacaoOk(true))
    } catch {
      setAnimacaoOk(true)
    }

    const pular = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setAnimacaoOk(true)
    }
    window.addEventListener('keydown', pular)

    return () => {
      window.removeEventListener('keydown', pular)
      dispose?.()
    }
  }, [])

  useEffect(() => {
    if (saindo || !animacaoOk || !liberado) return
    setSaindo(true)
    const t = setTimeout(onDone, 420)
    return () => clearTimeout(t)
  }, [animacaoOk, liberado, saindo, onDone])

  const esperandoChecks = animacaoOk && !liberado

  return (
    <div className={s.screen} data-leaving={saindo}>
      <div className={s.stage}>
        <canvas ref={canvasRef} className={s.canvas} />
      </div>

      <div className={s.wordmark}>PULSE</div>
      <div className={s.tagline}>
        {esperandoChecks ? 'conferindo o seu computador…' : 'preparando o seu computador'}
      </div>

      {!animacaoOk && (
        <button type="button" className={s.skip} onClick={() => setAnimacaoOk(true)}>
          pular
        </button>
      )}
    </div>
  )
}
