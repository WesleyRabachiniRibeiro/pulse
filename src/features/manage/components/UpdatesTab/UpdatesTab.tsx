import type { Upgrade } from '@shared/domain/inventory'
import { getProgram } from '@shared/domain/catalog'
import { useInventory } from '@/features/catalog'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import s from '../tabs.module.css'

interface UpdatesProps {
  loaded: boolean
  onUpdate: (programId: string) => void
}

export function Updates({ loaded, onUpdate }: UpdatesProps) {
  const inventory = useInventory()

  if (!loaded) return <p className={s.empty}>Perguntando ao winget quem tem versão nova…</p>
  if (inventory.upgrades.length === 0) {
    return <p className={s.empty}>Nenhum programa deste PC tem versão nova esperando.</p>
  }

  return (
    <>
      {inventory.upgrades.map((upgrade) => (
        <UpdateItem key={upgrade.wingetId} upgrade={upgrade} onUpdate={onUpdate} />
      ))}
    </>
  )
}

function UpdateItem({ upgrade, onUpdate }: { upgrade: Upgrade; onUpdate: (id: string) => void }) {
  const program = upgrade.programId ? getProgram(upgrade.programId) : undefined

  return (
    <div className={s.item}>
      {program ? (
        <AppIcon id={program.id} name={program.name} size={28} />
      ) : (
        <span className={s.stranger}>—</span>
      )}

      <span className={s.body}>
        <span className={s.name}>{upgrade.name}</span>
        <span className={s.note}>{upgrade.wingetId}</span>
      </span>

      <span className={s.versions}>
        {upgrade.current}
        <span className={s.arrow}>→</span>
        <span className={s.fresh}>{upgrade.available}</span>
      </span>

      {program && (
        <span className={s.actions}>
          <button
            type="button"
            className={s.action}
            data-tone="main"
            onClick={() => onUpdate(program.id)}
          >
            ATUALIZAR
          </button>
        </span>
      )}
    </div>
  )
}
