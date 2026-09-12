import { useState } from 'react'
import { HistoryTab } from './HistoryTab'
import { UpdatesTab } from './UpdatesTab'
import { StartupTab } from './StartupTab'
import { InstalledTab } from './InstalledTab'
import s from './Manage.module.css'

type TabId = 'installed' | 'updates' | 'startup' | 'history'

interface Tab {
  id: TabId
  name: string
}

const TABS: readonly Tab[] = [
  { id: 'installed', name: 'INSTALADOS' },
  { id: 'updates', name: 'ATUALIZAÇÕES' },
  { id: 'startup', name: 'INICIALIZAÇÃO' },
  { id: 'history', name: 'HISTÓRICO' },
]

interface Props {
  onBack: () => void
}

export function Manage({ onBack }: Props) {
  const [tab, setTab] = useState<TabId>('installed')

  return (
    <div className={s.screen}>
      <header className={s.top}>
        <button type="button" className={s.back} onClick={onBack}>
          ← VOLTAR
        </button>
        <h2 className={s.title}>Gerenciamento</h2>

        <div className={s.tabs} role="tablist">
          {TABS.map((one) => (
            <button
              key={one.id}
              type="button"
              role="tab"
              aria-selected={tab === one.id}
              className={s.tab}
              onClick={() => setTab(one.id)}
            >
              {one.name}
            </button>
          ))}
        </div>
      </header>

      <div className={s.body}>
        {tab === 'installed' && <InstalledTab />}
        {tab === 'updates' && <UpdatesTab />}
        {tab === 'startup' && <StartupTab />}
        {tab === 'history' && <HistoryTab />}
      </div>
    </div>
  )
}
