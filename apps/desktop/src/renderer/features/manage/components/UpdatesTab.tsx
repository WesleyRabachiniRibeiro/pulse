import { useEffect, useState } from 'react'
import { PROGRAM_BY_ID, type Upgrade } from '@pulse/domain'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { bridge } from '@/shared/lib/bridge'
import s from './Manage.module.css'

export function UpdatesTab() {
  const [upgrades, setUpgrades] = useState<readonly Upgrade[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    void bridge
      .invoke('catalog:upgrades', undefined)
      .then((found) => {
        if (alive) setUpgrades(found)
      })
      .catch(() => {
        if (!alive) return
        setUpgrades([])
        setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [])

  if (upgrades === null) {
    return <p className={s.empty}>Perguntando ao winget o que tem atualização…</p>
  }

  if (failed) {
    return <p className={s.empty}>Não deu para falar com o winget agora. Tente de novo daqui a pouco.</p>
  }

  if (upgrades.length === 0) {
    return <p className={s.empty}>Tudo que o winget conhece está na última versão.</p>
  }

  return (
    <div className={s.list}>
      <div className={s.listTop}>
        <span className={s.listCount}>
          {upgrades.length} {upgrades.length === 1 ? 'atualização' : 'atualizações'}
        </span>
      </div>

      {upgrades.map((one) => {
        const program = one.programId ? PROGRAM_BY_ID.get(one.programId) : undefined

        return (
          <article key={one.wingetId} className={s.upgrade}>
            {program ? (
              <AppIcon id={program.id} name={program.name} size={28} />
            ) : (
              <span className={s.noIcon} aria-hidden />
            )}

            <div className={s.upgradeBody}>
              <span className={s.upgradeName}>{program?.name ?? one.name}</span>
              <span className={s.upgradeId}>{one.wingetId}</span>
            </div>

            <span className={s.versions}>
              <span className={s.from}>{one.current}</span>
              <span className={s.arrow} aria-hidden>
                →
              </span>
              <span className={s.to}>{one.available}</span>
            </span>
          </article>
        )
      })}

      <p className={s.footnote}>
        O Pulse ainda não atualiza por aqui. A lista é para você saber o que está para trás, e o
        comando é <code>winget upgrade --id</code> seguido do identificador.
      </p>
    </div>
  )
}
