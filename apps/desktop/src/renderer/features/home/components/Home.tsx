import { formatMb } from '@pulse/domain'
import { totalSizeMb } from '@pulse/utils'
import { useCatalog } from '@/features/catalog'
import { useTourStore } from '@/features/tour'
import s from './Home.module.css'

interface Props {
  onStart: () => void
  onManage: () => void
}

export function Home({ onStart, onManage }: Props) {
  const catalog = useCatalog()
  const programs = catalog.programs
  const total = totalSizeMb(catalog, programs.map((p) => p.id))

  return (
    <div className={s.screen}>
      <div className={s.eyebrow}>PULSE PARA WINDOWS</div>

      <h1 className={s.title}>
        Um PC novo pronto em <span className={s.highlight}>uma passada só</span>.
      </h1>

      <p className={s.subtitle}>
        Marque os programas, confira os padrões uma vez e deixe a fila trabalhar. Depois de
        instalar, o Pulse continua servindo: é daqui que você atualiza e remove o que já está no PC.
      </p>

      <div className={s.actions} data-tour="home">
        <button type="button" className={s.primary} onClick={onStart}>
          <span className={s.tag}>COMEÇAR</span>
          <span className={s.name}>Preparar este PC</span>
          <span className={s.note}>verificação, seleção e instalação</span>
        </button>

        <button type="button" className={s.secondary} onClick={onManage}>
          <span className={s.tag}>JÁ INSTALADO</span>
          <span className={s.name}>Gerenciar programas</span>
          <span className={s.note}>ver, atualizar e remover o que já está aqui</span>
        </button>
      </div>

      <div className={s.footnote}>
        <button
          type="button"
          className={s.link}
          onClick={() => useTourStore.getState().openTour()}
        >
          Ver como funciona
        </button>
        <span className={s.sep}>·</span>
        <span>
          {programs.length} programas no catálogo, {formatMb(total)} se você quisesse todos
        </span>
      </div>
    </div>
  )
}
