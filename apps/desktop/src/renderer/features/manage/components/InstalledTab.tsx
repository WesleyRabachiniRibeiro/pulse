import { useEffect, useMemo, useState } from 'react'
import { LuSearch } from 'react-icons/lu'
import { type InstalledFilter, type InstalledNode, type InstalledTree } from '@pulse/domain'
import { countNodes, filterInstalled } from '@pulse/utils'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { useCatalog } from '@/features/catalog'
import { bridge } from '@/shared/lib/bridge'
import s from './Manage.module.css'

const FILTERS: readonly { id: InstalledFilter; name: string }[] = [
  { id: 'all', name: 'TUDO' },
  { id: 'pulse', name: 'DO CATÁLOGO' },
  { id: 'stranger', name: 'O RESTO' },
]

function Row({ node, depth = 0 }: { node: InstalledNode; depth?: number }) {
  const catalog = useCatalog()
  const program = node.programId ? catalog.byId.get(node.programId) : undefined

  return (
    <div className={s.entry} data-depth={depth}>
      {program ? (
        <AppIcon id={program.id} name={program.name} size={depth === 0 ? 26 : 20} />
      ) : (
        <span className={s.noIcon} aria-hidden />
      )}

      <span className={s.entryBody}>
        <span className={s.entryName}>{node.name}</span>
        <span className={s.entryMeta}>
          {[node.publisher, node.version].filter(Boolean).join(' · ') || 'sem versão informada'}
        </span>
      </span>

      {node.wingetId && <span className={s.badge}>winget</span>}
    </div>
  )
}

export function InstalledTab() {
  const [tree, setTree] = useState<InstalledTree | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<InstalledFilter>('all')

  useEffect(() => {
    let alive = true
    void bridge
      .invoke('catalog:tree', undefined)
      .then((found) => {
        if (alive) setTree(found)
      })
      .catch(() => {
        if (alive) setTree({ nodes: [], hidden: 0 })
      })
    return () => {
      alive = false
    }
  }, [])

  const visible = useMemo(
    () => (tree ? filterInstalled(tree.nodes, query, filter) : []),
    [tree, query, filter],
  )

  if (tree === null) return <p className={s.empty}>Lendo o que está instalado neste PC…</p>

  if (tree.nodes.length === 0) {
    return <p className={s.empty}>Não deu para ler o registro de programas instalados.</p>
  }

  return (
    <div className={s.list}>
      <div className={s.search}>
        <LuSearch className={s.magnifier} size={15} aria-hidden />
        <input
          className={s.searchInput}
          value={query}
          placeholder="Buscar um programa…"
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar"
        />
        <span className={s.listCount}>
          {countNodes(visible)} de {countNodes(tree.nodes)}
        </span>
      </div>

      <div className={s.filters}>
        {FILTERS.map((one) => (
          <button
            key={one.id}
            type="button"
            className={s.mode}
            aria-pressed={filter === one.id}
            onClick={() => setFilter(one.id)}
          >
            {one.name}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className={s.empty}>Nada com esse nome por aqui.</p>
      ) : (
        visible.map((node) => (
          <div key={node.key} className={s.group}>
            <Row node={node} />
            {node.children.map((child) => (
              <Row key={child.key} node={child} depth={1} />
            ))}
          </div>
        ))
      )}

      {tree.hidden > 0 && (
        <p className={s.footnote}>
          {tree.hidden} {tree.hidden === 1 ? 'entrada escondida' : 'entradas escondidas'}: componentes
          do Windows, atualizações e coisas sem como desinstalar. Elas não são programas que você
          instalou.
        </p>
      )}
    </div>
  )
}
