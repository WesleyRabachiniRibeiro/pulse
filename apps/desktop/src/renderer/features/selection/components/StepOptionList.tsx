import { useMemo, useState } from 'react'
import { LuSearch } from 'react-icons/lu'
import { categoriesOf, normalizeText, type AnyStep } from '@pulse/domain'
import s from './AppSettings.module.css'
import { CheckOption } from './CheckOption'
import { StepSection } from './StepSection'

interface Props {
  step: AnyStep
  programId: string
  chosen: readonly string[]
  onToggle: (step: AnyStep, id: string) => void
}

// Cada lista guarda a própria busca e o próprio filtro: um programa pode
// oferecer mais de uma, e digitar numa não pode mexer na outra.
export function StepOptionList({ step, programId, chosen, onToggle }: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Tudo')

  const options = useMemo(
    () => step.optionsFor?.(programId) ?? step.options ?? [],
    [step, programId],
  )
  const categories = useMemo(() => categoriesOf(options), [options])

  const term = normalizeText(search.trim())
  const visible = options.filter(
    (o) =>
      (filter === 'Tudo' || o.category === filter) && (!term || normalizeText(o.name).includes(term)),
  )

  return (
    <StepSection title={step.title} description={step.description} tour="aj-kind">

      <div className={s.search}>
        <LuSearch className={s.magnifier} size={15} aria-hidden />
        <input
          className={s.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={step.searchPlaceholder ?? 'Buscar…'}
          aria-label="Buscar"
        />
        <span className={s.count}>
          {visible.length} de {options.length}
        </span>
      </div>

      <div className={s.filters}>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={s.filter}
            aria-pressed={filter === c}
            onClick={() => setFilter(c)}
          >
            {c} · {c === 'Tudo' ? options.length : options.filter((o) => o.category === c).length}
          </button>
        ))}
      </div>

      <div className={s.options}>
        {visible.length === 0 ? (
          <p className={s.empty}>Nada com esse nome por aqui.</p>
        ) : (
          visible.map((o) => (
            <CheckOption
              key={o.id}
              checked={chosen.includes(o.id)}
              name={o.name}
              hint={o.hint}
              category={o.category}
              onToggle={() => onToggle(step, o.id)}
            />
          ))
        )}
      </div>
    </StepSection>
  )
}
