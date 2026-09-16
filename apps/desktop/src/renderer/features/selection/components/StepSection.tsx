import type { ReactNode } from 'react'
import s from './AppSettings.module.css'

interface Props {
  title: ReactNode
  description?: ReactNode
  tour?: string
  children?: ReactNode
}

export function StepSection({ title, description, tour, children }: Props) {
  return (
    <section className={s.section} {...(tour ? { 'data-tour': tour } : {})}>
      <div className={s.label}>{title}</div>
      {description !== undefined && <p className={s.description}>{description}</p>}
      {children}
    </section>
  )
}
