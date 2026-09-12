import { ParentalSection } from '@/features/parental'
import s from './Config.module.css'

interface Props {
  onBack: () => void
}

// A casca das configurações. Por enquanto hospeda só o controle dos pais; o
// perfil e a portabilidade entram aqui depois.
export function Config({ onBack }: Props) {
  return (
    <div className={s.screen}>
      <header className={s.top}>
        <button type="button" className={s.back} onClick={onBack}>
          ← VOLTAR
        </button>
        <h2 className={s.title}>Configurações</h2>
      </header>

      <div className={s.body}>
        <ParentalSection />
      </div>
    </div>
  )
}
