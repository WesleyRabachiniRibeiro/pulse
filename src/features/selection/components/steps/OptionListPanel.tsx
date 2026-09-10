import { useMemo, useState } from 'react'
import { LuSearch } from 'react-icons/lu'
import { categoriesOf } from '@shared/domain/steps'
import s from '../panels.module.css'
import type { PanelProps } from './panel'

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function OptionListPanel({ step, programId, value, onChange }: PanelProps<string[]>) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Tudo')

  const options = step.optionsFor ? step.optionsFor(programId) : (step.options ?? [])
  const categories = useMemo(() => categoriesOf(options), [options])
  const checked = value ?? []

  const term = normalize(search.trim())
  const visible = options.filter(
    (option) =>
      (filter === 'Tudo' || option.category === filter) &&
      (!term || normalize(option.name).includes(term)),
  )

  const searchable = options.length > 6

  function toggle(id: string) {
    const next = checked.includes(id) ? checked.filter((one) => one !== id) : [...checked, id]
    onChange(next.length > 0 ? next : undefined)
  }

  return (
    <>
      {searchable && (
        <>
          <div className={s.search}>
            <LuSearch className={s.magnifier} size={15} aria-hidden />
            <input
              className={s.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              aria-label="Buscar"
            />
            <span className={s.count}>
              {visible.length} de {options.length}
            </span>
          </div>

          <div className={s.filters}>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={s.filter}
                aria-pressed={filter === category}
                onClick={() => setFilter(category)}
              >
                {category} ·{' '}
                {category === 'Tudo'
                  ? options.length
                  : options.filter((one) => one.category === category).length}
              </button>
            ))}
          </div>
        </>
      )}

      <div className={s.options}>
        {visible.length === 0 ? (
          <p className={s.empty}>Nada com esse nome por aqui.</p>
        ) : (
          visible.map((option) => (
            <button
              key={option.id}
              type="button"
              role="checkbox"
              aria-checked={checked.includes(option.id)}
              className={s.option}
              onClick={() => toggle(option.id)}
            >
              <span className={s.box} aria-hidden>
                {checked.includes(option.id) ? '✓' : ''}
              </span>
              <span className={s.optionBody}>
                <span className={s.optionName}>{option.name}</span>
                <span className={s.optionHint}>{option.hint}</span>
              </span>
              <span className={s.optionCategory}>{option.category.toUpperCase()}</span>
            </button>
          ))
        )}
      </div>
    </>
  )
}
