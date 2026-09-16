import { installUpdate, useUpdate } from '../store/useUpdate'
import s from './UpdatePill.module.css'

export function UpdatePill() {
  const update = useUpdate()

  if (update.status === 'downloading') {
    return (
      <span className={s.quiet} title={`Baixando a versão ${update.version ?? ''}`}>
        baixando atualização {update.percent}%
      </span>
    )
  }

  if (update.status !== 'ready') return null

  if (update.blocked) {
    return (
      <span className={s.quiet} title="A atualização entra quando a fila terminar">
        atualização pronta · espera a fila
      </span>
    )
  }

  return (
    <button
      type="button"
      className={s.pill}
      onClick={() => void installUpdate()}
      title={`Reiniciar para instalar a versão ${update.version ?? ''}`}
    >
      atualizar e reiniciar
    </button>
  )
}
