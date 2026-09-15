import { useState } from 'react'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { useCatalog } from '@/features/catalog'
import { bridge } from '@/shared/lib/bridge'
import { useInventoryLoaded, useUpgrades } from '../store/useInventory'
import shell from './tabs.module.css'

interface Props {
  onUpdate: (programId: string) => void
}

export function UpdatesTab({ onUpdate }: Props) {
  const catalog = useCatalog()
  const upgrades = useUpgrades()
  const loaded = useInventoryLoaded()
  const [copied, setCopied] = useState<string | null>(null)

  // Quem não está no catálogo o Pulse não atualiza, mas o comando resolve —
  // e ele é comprido demais para alguém digitar de memória.
  async function copyCommand(wingetId: string) {
    await bridge
      .invoke('system:copy', { text: `winget upgrade --id ${wingetId}` })
      .catch(() => undefined)
    setCopied(wingetId)
  }

  if (!loaded) return <p className={shell.empty}>Perguntando ao winget quem tem versão nova…</p>

  if (upgrades.length === 0) {
    return <p className={shell.empty}>Nenhum programa deste PC tem versão nova esperando.</p>
  }

  return (
    <>
      {upgrades.map((one) => {
        const program = one.programId ? catalog.byId.get(one.programId) : undefined

        return (
          <div key={one.wingetId} className={shell.item}>
            {program ? (
              <AppIcon id={program.id} name={program.name} size={28} />
            ) : (
              <span className={shell.stranger}>—</span>
            )}

            <span className={shell.body}>
              <span className={shell.name}>{program?.name ?? one.name}</span>
              <span className={shell.note}>{one.wingetId}</span>
            </span>

            <span className={shell.versions}>
              {one.current}
              <span className={shell.arrow}>→</span>
              <span className={shell.fresh}>{one.available}</span>
            </span>

            <span className={shell.actions}>
              <button
                type="button"
                className={shell.action}
                onClick={() => void copyCommand(one.wingetId)}
                title={`Copiar: winget upgrade --id ${one.wingetId}`}
              >
                {copied === one.wingetId ? 'COPIADO' : 'COPIAR COMANDO'}
              </button>

              {program && (
                <button
                  type="button"
                  className={shell.action}
                  data-tone="main"
                  onClick={() => onUpdate(program.id)}
                >
                  ATUALIZAR
                </button>
              )}
            </span>
          </div>
        )
      })}
    </>
  )
}
