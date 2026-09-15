import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { useCatalog } from '@/features/catalog'
import { useInventoryLoaded, useUpgrades } from '../store/useInventory'
import shell from './tabs.module.css'

interface Props {
  onUpdate: (programId: string) => void
}

export function UpdatesTab({ onUpdate }: Props) {
  const catalog = useCatalog()
  const upgrades = useUpgrades()
  const loaded = useInventoryLoaded()

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

            {program && (
              <span className={shell.actions}>
                <button
                  type="button"
                  className={shell.action}
                  data-tone="main"
                  onClick={() => onUpdate(program.id)}
                >
                  ATUALIZAR
                </button>
              </span>
            )}
          </div>
        )
      })}
    </>
  )
}
