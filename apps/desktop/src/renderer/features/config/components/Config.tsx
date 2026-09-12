import { ParentalSection } from '@/features/parental'
import { WindowsSection } from './WindowsSection'
import s from './Config.module.css'

interface Props {
  onBack: () => void
}

// A casca das configurações. O perfil e a portabilidade entram aqui depois.
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
        <WindowsSection />
        <ParentalSection />
      </div>
    </div>
  )
}
