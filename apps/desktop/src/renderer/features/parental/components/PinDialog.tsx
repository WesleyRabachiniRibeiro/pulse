import { useEffect, useRef, useState } from 'react'
import { PIN_DESC, PIN_LENGTH, PIN_TITLE, pinIsValid, type PinPurpose } from '@pulse/domain'
import s from './PinDialog.module.css'

interface Props {
  purpose: PinPurpose
  // 'change' pede dois: o de agora e o novo.
  onConfirm: (pin: string, next?: string) => Promise<boolean>
  onCancel: () => void
}

function onlyDigits(text: string): string {
  return text.replace(/\D/g, '').slice(0, PIN_LENGTH)
}

export function PinDialog({ purpose, onConfirm, onCancel }: Props) {
  const wantsTwo = purpose === 'change'
  const [pin, setPin] = useState('')
  const [next, setNext] = useState('')
  const [checking, setChecking] = useState(false)
  const [wrong, setWrong] = useState(false)
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    first.current?.focus()
  }, [])

  const ready = pinIsValid(pin) && (!wantsTwo || pinIsValid(next))

  async function confirm() {
    if (!ready || checking) return

    setChecking(true)
    setWrong(false)
    const ok = await onConfirm(pin, wantsTwo ? next : undefined)
    setChecking(false)

    if (ok) return

    // Erra e recomeça: deixar os dígitos na tela só atrapalha a próxima tentativa.
    setWrong(true)
    setPin('')
    setNext('')
    first.current?.focus()
  }

  return (
    <div
      className={s.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={PIN_TITLE[purpose]}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
          if (e.key === 'Enter') void confirm()
        }}
      >
        <div className={s.label}>{PIN_TITLE[purpose]}</div>
        <p className={s.description}>{PIN_DESC[purpose]}</p>

        <div className={s.fields}>
          <label className={s.field}>
            <span className={s.fieldName}>{wantsTwo ? 'PIN de agora' : 'PIN'}</span>
            <input
              ref={first}
              className={s.input}
              value={pin}
              inputMode="numeric"
              autoComplete="off"
              type="password"
              placeholder={'•'.repeat(PIN_LENGTH)}
              onChange={(e) => setPin(onlyDigits(e.target.value))}
            />
          </label>

          {wantsTwo && (
            <label className={s.field}>
              <span className={s.fieldName}>PIN novo</span>
              <input
                className={s.input}
                value={next}
                inputMode="numeric"
                autoComplete="off"
                type="password"
                placeholder={'•'.repeat(PIN_LENGTH)}
                onChange={(e) => setNext(onlyDigits(e.target.value))}
              />
            </label>
          )}
        </div>

        <p className={s.status} role={wrong ? 'alert' : undefined}>
          {wrong
            ? 'PIN incorreto. Tente de novo.'
            : `São ${PIN_LENGTH} números.`}
        </p>

        <div className={s.actions}>
          <button type="button" className={s.ghost} onClick={onCancel}>
            CANCELAR
          </button>
          <button
            type="button"
            className={s.confirm}
            disabled={!ready || checking}
            onClick={() => void confirm()}
          >
            {checking ? 'CONFERINDO…' : 'CONFIRMAR'}
          </button>
        </div>
      </div>
    </div>
  )
}
