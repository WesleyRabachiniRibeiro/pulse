import { useMemo, useState } from 'react'
import { LuBan, LuSearch } from 'react-icons/lu'
import { formatMb } from '@pulse/domain'
import { filterCatalog, groupByCategory } from '@pulse/utils'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { useCatalog } from '@/features/catalog'
import { setParentalBlocked, useParental } from '../store/useParental'
import s from './BlockedList.module.css'

interface Props {
  onDone: () => void
}

function railLabel(name: string): string {
  const low = name.toLocaleLowerCase('pt-BR')
  return low.charAt(0).toLocaleUpperCase('pt-BR') + low.slice(1)
}

export function BlockedList({ onDone }: Props) {
  const catalog = useCatalog()
  const view = useParental()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(new Set(view.blocked))
  const [saving, setSaving] = useState(false)

  const found = useMemo(() => filterCatalog(catalog, query), [catalog, query])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const one of found) map.set(one.category, (map.get(one.category) ?? 0) + 1)
    return map
  }, [found])

  const shown = useMemo(
    () =>
      found
        .filter((one) => category === null || one.category === category)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })),
    [found, category],
  )

  const basket = useMemo(
    () => groupByCategory(catalog, catalog.programs.filter((one) => blocked.has(one.id))),
    [catalog, blocked],
  )

  function toggle(id: string) {
    setBlocked((old) => {
      const next = new Set(old)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function done() {
    setSaving(true)
    await setParentalBlocked([...blocked])
    setSaving(false)
    onDone()
  }

  return (
    <div className={s.screen}>
      <header className={s.top}>
        <div className={s.heading}>
          <div className={s.step}>MARCAR AQUI SIGNIFICA PROIBIR</div>
          <h2 className={s.title}>O que a criança não pode instalar</h2>
        </div>

        <div className={s.search}>
          <LuSearch className={s.magnifier} size={15} aria-hidden />
          <input
            className={s.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar entre ${catalog.programs.length} programas…`}
            aria-label="Buscar programas"
          />
          {query && (
            <button
              type="button"
              className={s.clear}
              aria-label="Limpar a busca"
              onClick={() => setQuery('')}
            >
              ✕
            </button>
          )}
        </div>
      </header>

      <div className={s.body}>
        <aside className={s.rail}>
          <div className={s.railLabel}>CATEGORIAS</div>

          <button
            type="button"
            className={s.railItem}
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
          >
            <span className={s.railName}>Todos</span>
            <span className={s.railCount}>{found.length}</span>
          </button>

          {catalog.categories.map((one) => {
            const amount = counts.get(one.id) ?? 0
            return (
              <button
                key={one.id}
                type="button"
                className={s.railItem}
                aria-pressed={category === one.id}
                disabled={amount === 0}
                onClick={() => setCategory(one.id)}
              >
                <span className={s.railName}>{railLabel(one.name)}</span>
                <span className={s.railCount}>{amount}</span>
              </button>
            )
          })}
        </aside>

        <section className={s.main}>
          <div className={s.list}>
            {shown.length === 0 ? (
              <p className={s.empty}>Nenhum programa com esse nome no catálogo.</p>
            ) : (
              <div className={s.grid}>
                {shown.map((one) => {
                  const on = blocked.has(one.id)
                  return (
                    <button
                      key={one.id}
                      type="button"
                      className={s.card}
                      aria-pressed={on}
                      onClick={() => toggle(one.id)}
                    >
                      <span className={s.mark} aria-hidden>
                        {on ? <LuBan size={12} /> : null}
                      </span>

                      <AppIcon id={one.id} name={one.name} size={27} />

                      <span className={s.cardTexts}>
                        <span className={s.cardName}>{one.name}</span>
                        <span className={s.cardMeta}>
                          {on ? 'bloqueado' : formatMb(one.mb)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <aside className={s.basket}>
          <div className={s.basketHead}>
            <span className={s.basketLabel}>BLOQUEADOS</span>
            <span className={s.basketCount}>{blocked.size}</span>
            <span className={s.spacer} />
            {blocked.size > 0 && (
              <button
                type="button"
                className={s.basketClear}
                onClick={() => setBlocked(new Set())}
              >
                LIMPAR
              </button>
            )}
          </div>

          <div className={s.basketBody}>
            {blocked.size === 0 ? (
              <p className={s.basketEmpty}>
                Nada bloqueado. Com a lista vazia, o controle ligado ainda pede o PIN para tirar
                programa do PC e para se desligar.
              </p>
            ) : (
              basket.map((group) => (
                <div key={group.category.id} className={s.basketGroup}>
                  <div className={s.basketGroupName}>{group.category.name}</div>
                  {group.programs.map((one) => (
                    <div key={one.id} className={s.basketItem}>
                      <LuBan className={s.basketMark} size={11} aria-hidden />
                      <span className={s.basketItemName}>{one.name}</span>
                      <button
                        type="button"
                        className={s.remove}
                        aria-label={`Liberar ${one.name}`}
                        onClick={() => toggle(one.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      <footer className={s.footer}>
        <span className={s.summary}>
          {blocked.size === 0
            ? 'nada bloqueado'
            : `${blocked.size} ${blocked.size === 1 ? 'bloqueado' : 'bloqueados'}`}
        </span>

        <div className={s.footerActions}>
          <button type="button" className={s.secondary} onClick={onDone}>
            Voltar sem salvar
          </button>
          <button type="button" className={s.primary} disabled={saving} onClick={() => void done()}>
            {saving ? 'Salvando…' : 'Pronto'}
          </button>
        </div>
      </footer>
    </div>
  )
}
