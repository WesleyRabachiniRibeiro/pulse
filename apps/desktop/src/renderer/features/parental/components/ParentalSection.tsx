import { useState } from 'react'
import { CATALOG, type PinPurpose } from '@pulse/domain'
import { groupByCategory } from '@pulse/utils'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import {
  changeParentalPin,
  checkParentalPin,
  setParentalBlocked,
  turnOffParental,
  turnOnParental,
  useParental,
} from '../store/useParental'
import { PinDialog } from './PinDialog'
import { useCatalog } from '@/features/catalog'
import s from './ParentalSection.module.css'

export function ParentalSection() {
  const catalog = useCatalog()
  const { on, hasPin, blocked } = useParental()
  const [asking, setAsking] = useState<PinPurpose | null>(null)
  const [editing, setEditing] = useState(false)

  const locked = on && hasPin
  const groups = groupByCategory(catalog, CATALOG)

  // 'list' só confere o PIN: mexer na lista não liga nem desliga o controle.
  function answer(purpose: PinPurpose, pin: string, next?: string): Promise<boolean> {
    if (purpose === 'change') return changeParentalPin(pin, next ?? '')
    if (purpose === 'turnOff') return turnOffParental(pin)
    if (purpose === 'list') return checkParentalPin(pin)
    return turnOnParental(pin)
  }

  async function confirm(pin: string, next?: string): Promise<boolean> {
    const purpose = asking
    if (!purpose) return false

    const ok = await answer(purpose, pin, next)
    if (!ok) return false

    setAsking(null)
    if (purpose === 'list') setEditing(true)
    return true
  }

  function toggle(id: string) {
    const next = blocked.includes(id) ? blocked.filter((x) => x !== id) : [...blocked, id]
    void setParentalBlocked(next)
  }

  return (
    <section className={s.section}>
      <div className={s.label}>CONTROLE DOS PAIS</div>
      <p className={s.description}>
        Com ele ligado, os programas que você marcar aqui não podem ser instalados sem o PIN. A
        lista vale só para este computador, e quem escolhe o que entra nela é você.
      </p>

      <div className={s.row}>
        <div className={s.state} data-on={locked}>
          <span className={s.dot} aria-hidden />
          <span>{locked ? 'Ligado' : hasPin ? 'Desligado' : 'Sem PIN cadastrado'}</span>
        </div>

        <div className={s.buttons}>
          {locked ? (
            <button type="button" className={s.ghost} onClick={() => setAsking('turnOff')}>
              DESLIGAR
            </button>
          ) : (
            <button type="button" className={s.primary} onClick={() => setAsking(hasPin ? 'turnOn' : 'create')}>
              {hasPin ? 'LIGAR' : 'CRIAR PIN'}
            </button>
          )}

          {hasPin && (
            <button type="button" className={s.ghost} onClick={() => setAsking('change')}>
              TROCAR O PIN
            </button>
          )}
        </div>
      </div>

      {hasPin && (
        <div className={s.list}>
          <div className={s.listTop}>
            <span className={s.listCount}>
              {blocked.length === 0
                ? 'Nenhum programa bloqueado'
                : `${blocked.length} ${blocked.length === 1 ? 'programa bloqueado' : 'programas bloqueados'}`}
            </span>
            <button
              type="button"
              className={s.ghost}
              onClick={() => (editing ? setEditing(false) : setAsking('list'))}
            >
              {editing ? 'PRONTO' : 'MEXER NA LISTA'}
            </button>
          </div>

          {editing &&
            groups.map((group) => (
              <div key={group.category.id} className={s.group}>
                <div className={s.groupName}>{group.category.name}</div>
                <div className={s.programs}>
                  {group.programs.map((program) => (
                    <button
                      key={program.id}
                      type="button"
                      role="checkbox"
                      aria-checked={blocked.includes(program.id)}
                      className={s.program}
                      onClick={() => toggle(program.id)}
                    >
                      <span className={s.box} aria-hidden>
                        {blocked.includes(program.id) ? '✓' : ''}
                      </span>
                      <AppIcon id={program.id} name={program.name} size={22} />
                      <span className={s.programName}>{program.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {asking && (
        <PinDialog purpose={asking} onConfirm={confirm} onCancel={() => setAsking(null)} />
      )}
    </section>
  )
}
