import { useState } from 'react'
import s from './ClampedText.module.css'

interface Props {
  text: string
  limit?: number
  className?: string
}

export function ClampedText({ text, limit = 130, className }: Props) {
  const [open, setOpen] = useState(false)
  const needsCutting = text.length > limit

  if (!needsCutting) return <span className={className}>{text}</span>

  return (
    <span className={className}>
      {open ? text : `${text.slice(0, limit).trimEnd()}…`}{' '}
      <button type="button" className={s.toggle} onClick={() => setOpen((v) => !v)}>
        {open ? 'ver menos' : 'ver tudo'}
      </button>
    </span>
  )
}
