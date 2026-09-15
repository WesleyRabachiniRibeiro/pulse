import {
  formatGb,
  LOCALES,
  programsOverriding,
  TWEAKS,
  type DefaultKey,
  type Defaults,
} from '@pulse/domain'
import { ConfigRow, type Choice } from '@/shared/ui/ConfigRow/ConfigRow'
import { ParentalSection } from '@/features/parental'
import { useCatalog } from '@/features/catalog'
import { savePreference, useDefaults, usePreferences } from '@/features/preferences'
import { useDrives, useSelection, useWatchDrives } from '@/features/selection'
import { ProfileBlock } from './ProfileBlock'
import { TweakRow } from './TweakRow'
import { useWatchTweaks } from '../store/useTweaks'
import s from './Config.module.css'

const KEEP = 'manter'

interface Row {
  key: DefaultKey
  name: string
  hint: string
  choices: readonly Choice[]
}

const ROWS: readonly Row[] = [
  {
    key: 'scope',
    name: 'Instalar para quem',
    hint: 'Para todos deste PC costuma pedir a permissão de administrador uma vez por programa.',
    choices: [
      { id: KEEP, label: 'DO JEITO DO PROGRAMA' },
      { id: 'user', label: 'SÓ PARA MIM' },
      { id: 'machine', label: 'PARA TODOS' },
    ],
  },
  {
    key: 'locale',
    name: 'Idioma dos programas',
    hint: 'Quem só existe num idioma vem nele mesmo, e o resumo avisa em vez de falhar.',
    choices: [
      { id: KEEP, label: 'DO JEITO QUE VIER' },
      ...LOCALES.map((locale) => ({ id: locale.id, label: locale.name.toUpperCase() })),
    ],
  },
  {
    key: 'interactive',
    name: 'Janela do instalador',
    hint: 'Em silêncio é mais rápido e não pede nada no meio do caminho. Mostrar serve quando o silencioso falha.',
    choices: [
      { id: 'false', label: 'EM SILÊNCIO' },
      { id: 'true', label: 'MOSTRAR' },
    ],
  },
  {
    key: 'desktopShortcut',
    name: 'Atalho na área de trabalho',
    hint: 'Copiado do menu Iniciar depois que o programa entra. Quem não aparece no menu Iniciar não tem o que copiar.',
    choices: [
      { id: KEEP, label: 'COMO O INSTALADOR DEIXOU' },
      { id: 'true', label: 'CRIAR' },
      { id: 'false', label: 'NÃO CRIAR' },
    ],
  },
  {
    key: 'autostart',
    name: 'Abrir com o Windows',
    hint: 'É o mesmo interruptor da aba Inicializar do Gerenciador de Tarefas.',
    choices: [
      { id: KEEP, label: 'COMO ESTÁ' },
      { id: 'true', label: 'ABRIR' },
      { id: 'false', label: 'NÃO ABRIR' },
    ],
  },
]

const INSTALL_KEYS: readonly DefaultKey[] = ['scope', 'locale', 'interactive']

// Campo ausente é "manter", menos na janela do instalador: lá não escolher é
// escolher o silêncio, que é como o Pulse sempre instalou.
function chosenOf(defaults: Defaults, key: DefaultKey): string {
  const value = defaults[key]
  if (value !== undefined) return String(value)
  return key === 'interactive' ? 'false' : KEEP
}

function valueFor(key: DefaultKey, picked: string): Defaults[DefaultKey] {
  if (picked === KEEP) return undefined
  if (key === 'scope') return picked === 'machine' ? 'machine' : 'user'
  if (key === 'locale') return picked
  return picked === 'true'
}

interface Props {
  onOpenBlocked: () => void
}

export function Config({ onOpenBlocked }: Props) {
  const catalog = useCatalog()
  const defaults = useDefaults()
  const prefs = usePreferences()
  const settingsByApp = useSelection((st) => st.settings)
  const drivesByApp = useSelection((st) => st.drives)
  const drives = useDrives()

  useWatchDrives()
  useWatchTweaks()

  function pick(key: DefaultKey, picked: string): void {
    const next: Defaults = { ...defaults }
    const value = valueFor(key, picked)

    if (value === undefined) delete next[key]
    else Object.assign(next, { [key]: value })

    void savePreference({ defaults: next })
  }

  function namesOf(ids: readonly string[]): string[] {
    return ids.map((id) => catalog.byId.get(id)?.name ?? id)
  }

  const readingDrives = drives.length === 0
  const driveChoices: Choice[] = readingDrives
    ? [{ id: '', label: 'LENDO OS DISCOS…' }]
    : drives.map((drive) => ({
        id: drive.letter,
        label: `${drive.letter} · ${formatGb(drive.freeBytes)} LIVRES`,
      }))

  const driveExceptions = namesOf(
    Object.entries(drivesByApp)
      .filter(([, letter]) => letter !== prefs.drive)
      .map(([id]) => id),
  )

  const rowsFor = (keys: readonly DefaultKey[]): readonly Row[] =>
    ROWS.filter((row) => keys.includes(row.key))

  const otherKeys = ROWS.map((row) => row.key).filter((key) => !INSTALL_KEYS.includes(key))

  return (
    <div className={s.screen}>
      <div className={s.eyebrow}>SEMPRE DISPONÍVEL</div>
      <h2 className={s.title}>Configuração</h2>
      <p className={s.subtitle}>
        Define uma vez e vale para os {catalog.programs.length} programas. Cada programa ainda pode
        fugir do padrão na tela dele, e quando isso acontece aparece marcado aqui.
      </p>

      <div className={s.sections}>
        <ParentalSection onOpenBlocked={onOpenBlocked} />

        <ProfileBlock />

        <section className={s.section}>
          <div className={s.header}>
            <span className={s.name}>COMO INSTALAR</span>
            <span className={s.line} aria-hidden />
            <span className={s.scope}>VALE PARA TODOS</span>
          </div>

          <div className={s.rows}>
            <ConfigRow
              name="Disco onde instalar"
              hint="Vale para todo programa cujo instalador deixa escolher a pasta. Quem não deixa vai para o disco do sistema e avisa no resumo."
              choices={driveChoices}
              chosen={readingDrives ? '' : (prefs.drive ?? '')}
              busy={readingDrives}
              exceptions={driveExceptions}
              onPick={(letter) => void savePreference({ drive: letter })}
            />

            {rowsFor(INSTALL_KEYS).map((row) => (
              <ConfigRow
                key={row.key}
                name={row.name}
                hint={row.hint}
                choices={row.choices}
                chosen={chosenOf(defaults, row.key)}
                exceptions={namesOf(programsOverriding(settingsByApp, defaults, row.key))}
                onPick={(picked) => pick(row.key, picked)}
              />
            ))}
          </div>
        </section>

        <section className={s.section}>
          <div className={s.header}>
            <span className={s.name}>DEPOIS DE INSTALAR</span>
            <span className={s.line} aria-hidden />
            <span className={s.scope}>VALE PARA TODOS</span>
          </div>

          <div className={s.rows}>
            {rowsFor(otherKeys).map((row) => (
              <ConfigRow
                key={row.key}
                name={row.name}
                hint={row.hint}
                choices={row.choices}
                chosen={chosenOf(defaults, row.key)}
                exceptions={namesOf(programsOverriding(settingsByApp, defaults, row.key))}
                onPick={(picked) => pick(row.key, picked)}
              />
            ))}
          </div>
        </section>

        <section className={s.section}>
          <div className={s.header}>
            <span className={s.name}>AJUSTES DO WINDOWS</span>
            <span className={s.line} aria-hidden />
            <span className={s.scope}>MEXE NO SISTEMA, NÃO NOS PROGRAMAS</span>
          </div>

          <div className={s.rows}>
            {TWEAKS.map((tweak) => (
              <TweakRow key={tweak.id} id={tweak.id} name={tweak.name} hint={tweak.hint} />
            ))}
          </div>

          <p className={s.note}>
            Estes não são programas e não entram na fila. Entram na hora, valem só para a sua conta
            do Windows e desfazem clicando de novo.
          </p>
        </section>
      </div>
    </div>
  )
}
