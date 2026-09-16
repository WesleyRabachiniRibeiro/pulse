import type { ReactNode } from 'react'
import s from './AppSettings.module.css'

interface Props {
  checked: boolean
  name: ReactNode
  hint: ReactNode
  category: ReactNode
  onToggle: () => void
  disabled?: boolean
  installed?: boolean
}

export function CheckOption({
  checked,
  name,
  hint,
  category,
  onToggle,
  disabled = false,
  installed = false,
}: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={s.option}
      onClick={onToggle}
      {...(disabled ? { disabled: true, 'aria-disabled': true } : {})}
      {...(installed ? { 'data-installed': true } : {})}
    >
      <span className={s.box} aria-hidden>
        {checked ? '✓' : ''}
      </span>
      <span className={s.optionBody}>
        <span className={s.optionName}>{name}</span>
        <span className={s.optionHint}>{hint}</span>
      </span>
      <span className={s.optionCategory}>{category}</span>
    </button>
  )
}
