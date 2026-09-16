import { useEffect, useRef, useState } from 'react'
import { PIN_DESC, PIN_LENGTH, PIN_TITLE, type PinPurpose } from '@pulse/domain'
import s from './PinDialog.module.css'

interface Props {
  purpose: PinPurpose
  extra?: string

  onDone: (pin: string) => Promise<string | null>
  onClose: () => void
}

export function PinDialog({ purpose, extra, onDone, onClose }: Props) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    field.current?.focus()
  }, [])

  async function confirm(value: string) {
    setBusy(true)
    const failure = await onDone(value)
    setBusy(false)

    if (failure) {
      setError(failure)
      setDigits('')
      field.current?.focus()
    }
  }

  function type(raw: string) {
    const clean = raw.replace(/\D/g, '').slice(0, PIN_LENGTH)
    setDigits(clean)
    setError(null)
    if (clean.length === PIN_LENGTH) void confirm(clean)
  }

  return (
    <div className={s.backdrop} onMouseDown={onClose}>
      <div
        className={s.box}
        role="dialog"
        aria-modal="true"
        aria-label={PIN_TITLE[purpose]}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={s.head}>
          <h2 className={s.title}>{PIN_TITLE[purpose]}</h2>
          <button type="button" className={s.close} aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className={s.desc}>{extra ?? PIN_DESC[purpose]}</p>

        <div className={s.casas} onClick={() => field.current?.focus()}>
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={s.casa}
              data-filled={i < digits.length}
              data-now={!busy && i === digits.length}
            >
              {i < digits.length ? '•' : ''}
            </span>
          ))}
        </div>

        <input
          ref={field}
          className={s.hidden}
          value={digits}
          inputMode="numeric"
          autoComplete="off"
          disabled={busy}
          aria-label={PIN_TITLE[purpose]}
          onChange={(e) => type(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'Enter' && digits.length === PIN_LENGTH) void confirm(digits)
          }}
        />

        {error && <div className={s.error}>{error}</div>}

        <p className={s.foot}>
          Esqueceu? Apagar o arquivo de preferências do Pulse devolve o app ao normal, com a lista
          de bloqueados junto.
        </p>
      </div>
    </div>
  )
}
