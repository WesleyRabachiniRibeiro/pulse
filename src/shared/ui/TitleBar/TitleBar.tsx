import type { ReactNode } from 'react'
import { LuCircleHelp } from 'react-icons/lu'
import { bridge } from '@/shared/lib/bridge'
import logo from '@/shared/assets/logo.png'
import s from './TitleBar.module.css'

interface Props {
  version: string
  onHome: () => void
  onHelp: () => void
  slot?: ReactNode
}

export function TitleBar({ version, onHome, onHelp, slot }: Props) {
  return (
    <div className={s.bar}>
      <button type="button" className={s.identity} onClick={onHome} title="Voltar ao início">
        <img className={s.brand} src={logo} alt="" aria-hidden />
        <span className={s.name}>Pulse</span>
        <span className={s.version}>{version}</span>
      </button>

      <div className={s.controls}>
        {slot}

        <button
          className={`${s.control} ${s.ajuda}`}
          data-tour="ajuda"
          onClick={onHelp}
          aria-label="Como o Pulse funciona"
          title="Como o Pulse funciona"
        >
          <LuCircleHelp size={15} />
        </button>
        <button
          className={s.control}
          onClick={() => void bridge.invoke('window:minimize')}
          aria-label="Minimizar"
        >
          &#8211;
        </button>
        <button
          className={s.control}
          onClick={() => void bridge.invoke('window:toggleMaximize')}
          aria-label="Maximizar"
        >
          &#9634;
        </button>
        <button
          className={`${s.control} ${s.close}`}
          onClick={() => void bridge.invoke('window:close')}
          aria-label="Fechar"
        >
          &#10005;
        </button>
      </div>
    </div>
  )
}
