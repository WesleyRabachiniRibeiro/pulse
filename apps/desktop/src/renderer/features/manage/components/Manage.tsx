import { useState } from 'react'
import { HistoryTab } from './HistoryTab'
import { UpdatesTab } from './UpdatesTab'
import s from './Manage.module.css'

type TabId = 'updates' | 'history'

interface Tab {
  id: TabId
  name: string
}

// As abas de instalados e inicialização entram aqui.
const TABS: readonly Tab[] = [
  { id: 'updates', name: 'ATUALIZAÇÕES' },
  { id: 'history', name: 'HISTÓRICO' },
]

interface Props {
  onBack: () => void
}

export function Manage({ onBack }: Props) {
  const [tab, setTab] = useState<TabId>('updates')

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
        {tab === 'updates' && <UpdatesTab />}
        {tab === 'history' && <HistoryTab />}
      </div>
    </div>
  )
}
