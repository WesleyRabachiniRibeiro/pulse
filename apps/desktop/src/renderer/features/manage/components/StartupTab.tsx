import { useState } from 'react'
import { type StartupEntry } from '@pulse/domain'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { useCatalog } from '@/features/catalog'
import { bridge } from '@/shared/lib/bridge'
import { setStartupEntries, useInventoryLoaded, useStartup } from '../store/useInventory'
import shell from './tabs.module.css'

function StartupItem({ entry }: { entry: StartupEntry }) {
  const catalog = useCatalog()
  const [busy, setBusy] = useState(false)
  const program = entry.programId ? catalog.byId.get(entry.programId) : undefined

  // A resposta é a lista relida do registro, então a tela mostra o que o
  // Windows tem e não o que foi pedido.
  async function toggle() {
    setBusy(true)
    const found = await bridge
      .invoke('catalog:setStartup', { name: entry.name, on: !entry.enabled })
      .catch(() => null)
    if (found) setStartupEntries(found)
    setBusy(false)
  }

  return (
    <div className={shell.item}>
      {program ? (
        <AppIcon id={program.id} name={program.name} size={28} />
      ) : (
        <span className={shell.stranger}>—</span>
      )}

      <span className={shell.body}>
        <span className={shell.name}>{program?.name ?? entry.name}</span>
        <span className={shell.note}>{entry.value || entry.name}</span>
      </span>

      <button
        type="button"
        className={shell.toggle}
        data-on={entry.enabled}
        disabled={busy}
        onClick={() => void toggle()}
      >
        {busy ? 'MUDANDO…' : entry.enabled ? 'ABRE' : 'NÃO ABRE'}
      </button>
    </div>
  )
}

export function StartupTab() {
  const entries = useStartup()
  const loaded = useInventoryLoaded()

  if (!loaded) return <p className={shell.empty}>Lendo o que abre junto com o Windows…</p>

  if (entries.length === 0) {
    return <p className={shell.empty}>Nada se cadastrou para abrir junto com o Windows.</p>
  }

  return (
    <>
      {entries.map((entry) => (
        <StartupItem key={entry.name} entry={entry} />
      ))}
    </>
  )
}
