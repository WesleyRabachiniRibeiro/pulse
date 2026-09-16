import { useEffect, useRef, useState } from 'react'
import { mountScene } from '../scene'
import s from './Splash.module.css'

interface Props {
  ready: boolean
  onDone: () => void
}

export function Splash({ ready, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [animationDone, setAnimationDone] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let dispose: (() => void) | undefined
    try {
      dispose = mountScene(canvas, () => setAnimationDone(true))
    } catch {
      setAnimationDone(true)
    }

    const skip = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setAnimationDone(true)
    }
    window.addEventListener('keydown', skip)

    return () => {
      window.removeEventListener('keydown', skip)
      dispose?.()
    }
  }, [])

  useEffect(() => {
    if (leaving || !animationDone || !ready) return
    setLeaving(true)
    const t = setTimeout(onDone, 420)
    return () => clearTimeout(t)
  }, [animationDone, ready, leaving, onDone])

  const waitingForChecks = animationDone && !ready

  return (
    <div className={s.screen} data-leaving={leaving}>
      <div className={s.stage}>
        <canvas ref={canvasRef} className={s.canvas} />
      </div>

      <div className={s.wordmark}>PULSE</div>
      <div className={s.tagline}>
        {waitingForChecks ? 'conferindo o seu computador…' : 'preparando o seu computador'}
      </div>

      {!animationDone && (
        <button type="button" className={s.skip} onClick={() => setAnimationDone(true)}>
          pular
        </button>
      )}
    </div>
  )
}
