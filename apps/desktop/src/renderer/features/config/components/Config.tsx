import { ParentalSection } from '@/features/parental'
import { WindowsSection } from './WindowsSection'
import { ProfileBlock } from './ProfileBlock'
import s from './Config.module.css'

interface Props {
  onBack: () => void
}


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
        <ProfileBlock />
        <WindowsSection />
        <ParentalSection />
      </div>
    </div>
  )
}
