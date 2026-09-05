import { CATALOG, formatMb, totalSizeMb } from '@shared/domain/catalog'
import { useTourStore } from '@/features/tour'
import logo from '@/shared/assets/logo.png'
import s from './Home.module.css'

interface Props {
  onStart: () => void
}

const CARTOES = [
  {
    titulo: 'Instala em sequência',
    texto:
      'Você marca tudo de uma vez e a fila cuida do resto, até três programas ao mesmo tempo. Nada de clicar em avançar num instalador atrás do outro.',
  },
  {
    titulo: 'Cada um do seu jeito',
    texto:
      'Disco próprio, versão, extensões, jogos, abrir ou não com o Windows. Os ajustes ficam dentro do cartão de cada programa.',
  },
  {
    titulo: 'Dá para sair de perto',
    texto:
      'Se algo falhar ou precisar de você, o Windows avisa com som e marca o ícone na barra de tarefas. No fim, um resumo do que entrou e do que não entrou.',
  },
]

export function Home({ onStart }: Props) {
  const total = totalSizeMb(CATALOG.map((p) => p.id))

  return (
    <div className={s.screen}>
      <div className={s.miolo}>
        <div className={s.hero} data-tour="home">
          <img className={s.art} src={logo} alt="" aria-hidden />

          <div className={s.eyebrow}>PULSE</div>

          <h1 className={s.title}>
            Seu PC pronto em uma <span className={s.highlight}>única passada</span>.
          </h1>

          <p className={s.subtitle}>
            Escolha os programas que você quer, mande instalar e vá fazer outra coisa. O Pulse baixa
            e instala tudo em sequência, do jeito que você pediu, e avisa quando terminar.
          </p>

          <div className={s.actions}>
            <button type="button" className={s.primary} onClick={onStart}>
              Começar
            </button>
            <button
              type="button"
              className={s.secondary}
              onClick={() => useTourStore.getState().abrir()}
            >
              Ver como funciona
            </button>
          </div>
        </div>

        <div className={s.cards}>
          {CARTOES.map((c) => (
            <div key={c.titulo} className={s.card}>
              <div className={s.cardTitle}>{c.titulo}</div>
              <p className={s.cardText}>{c.texto}</p>
            </div>
          ))}
        </div>

        <div className={s.footnote}>
          {CATALOG.length} programas no catálogo · {formatMb(total)} se você quisesse todos
        </div>
      </div>
    </div>
  )
}
