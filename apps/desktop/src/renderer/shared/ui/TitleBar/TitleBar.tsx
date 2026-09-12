import { LuCircleHelp, LuSettings, LuLayoutList } from 'react-icons/lu'
import { bridge } from '@/shared/lib/bridge'
import { useTourStore } from '@/features/tour'
import { UpdatePill } from '@/features/updates'
import logo from '@/shared/assets/logo.png'
import s from './TitleBar.module.css'

interface Props {
  version: string
  onHome: () => void
  onConfig: () => void
  onManage: () => void
}

export function TitleBar({ version, onHome, onConfig, onManage }: Props) {
  return (
    <div className={s.bar}>
      <button type="button" className={s.identity} onClick={onHome} title="Voltar ao início">
        <img className={s.brand} src={logo} alt="" aria-hidden />
        <span className={s.name}>Pulse</span>
        <span className={s.version}>{version}</span>
      </button>

      <div className={s.controls}>
        <UpdatePill />

        <button
          className={s.control}
          onClick={onManage}
          aria-label="Gerenciamento"
          title="Gerenciamento"
        >
          <LuLayoutList size={15} />
        </button>
        <button
          className={s.control}
          onClick={onConfig}
          aria-label="Configurações"
          title="Configurações"
        >
          <LuSettings size={15} />
        </button>
        <button
          className={`${s.control} ${s.ajuda}`}
          data-tour="ajuda"
          onClick={() => useTourStore.getState().openTour()}
          aria-label="Como o Pulse funciona"
          title="Como o Pulse funciona"
        >
          <LuCircleHelp size={15} />
        </button>
        <button
          className={s.control}
          onClick={() => void bridge.invoke('window:minimize', undefined)}
          aria-label="Minimizar"
        >
          &#8211;
        </button>
        <button
          className={s.control}
          onClick={() => void bridge.invoke('window:toggleMaximize', undefined)}
          aria-label="Maximizar"
        >
          &#9634;
        </button>
        <button
          className={`${s.control} ${s.close}`}
          onClick={() => void bridge.invoke('window:close', undefined)}
          aria-label="Fechar"
        >
          &#10005;
        </button>
      </div>
    </div>
  )
}
