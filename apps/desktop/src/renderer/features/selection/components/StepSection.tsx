import type { ReactNode } from 'react'
import s from './AppSettings.module.css'

interface Props {
  title: ReactNode
  description?: ReactNode
  tour?: string
  children?: ReactNode
}

// Todo bloco da tela de ajustes abre igual: um rótulo em maiúsculas e um
// parágrafo explicando o que aquilo faz antes de mostrar as escolhas.
export function StepSection({ title, description, tour, children }: Props) {
  return (
    <section className={s.section} {...(tour ? { 'data-tour': tour } : {})}>
      <div className={s.label}>{title}</div>
      {description !== undefined && <p className={s.description}>{description}</p>}
      {children}
    </section>
  )
}
