import { DEFAULT_KEYS, defaultLabel, programsOverriding, type DefaultKey } from '@shared/domain/defaults'
import { TWEAKS } from '@shared/domain/windows'
import { usePrograms } from '@/features/catalog'
import { useDefaults } from '@/features/preferences'
import { useSelection } from '@/features/selection'
import s from './Config.module.css'

const GROUPS: { name: string; scope: string; keys: readonly DefaultKey[] }[] = [
  { name: 'COMO INSTALAR', scope: 'VALE PARA TODOS', keys: ['scope', 'locale', 'interactive'] },
  { name: 'DEPOIS DE INSTALAR', scope: 'VALE PARA TODOS', keys: ['desktopShortcut', 'autostart'] },
]

const ROW_NAME: Record<DefaultKey, string> = {
  scope: 'Instalar para quem',
  locale: 'Idioma dos programas',
  interactive: 'Janela do instalador',
  desktopShortcut: 'Atalho na área de trabalho',
  autostart: 'Abrir com o Windows',
}

export function Config() {
  const defaults = useDefaults()
  const settingsByApp = useSelection((st) => st.settings)
  const programs = usePrograms()

  return (
    <div className={s.screen}>
      <div className={s.eyebrow}>SEMPRE DISPONÍVEL</div>
      <h2 className={s.title}>Configuração</h2>
      <p className={s.subtitle}>
        Define uma vez e vale para os {programs.length} programas. Cada programa ainda pode fugir do
        padrão na tela dele, e quando isso acontece aparece marcado aqui.
      </p>

      <div className={s.sections}>
        {GROUPS.map((group) => (
          <section key={group.name} className={s.section}>
            <div className={s.header}>
              <span className={s.name}>{group.name}</span>
              <span className={s.line} aria-hidden />
              <span className={s.scope}>{group.scope}</span>
            </div>

            <div className={s.rows}>
              {group.keys.map((key) => {
                const fugindo = programsOverriding(settingsByApp, defaults, key)
                return (
                  <div key={key} className={s.row}>
                    <span className={s.rowName}>{ROW_NAME[key]}</span>
                    <span className={s.rowValue}>{defaultLabel(key, defaults)}</span>
                    {fugindo.length > 0 && (
                      <span className={s.rowExceptions}>
                        {fugindo.length} {fugindo.length === 1 ? 'exceção' : 'exceções'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}

        <section className={s.section}>
          <div className={s.header}>
            <span className={s.name}>AJUSTES DO WINDOWS</span>
            <span className={s.line} aria-hidden />
            <span className={s.scope}>MEXE NO SISTEMA, NÃO NOS PROGRAMAS</span>
          </div>

          <div className={s.rows}>
            {TWEAKS.map((tweak) => (
              <div key={tweak.id} className={s.row}>
                <span className={s.rowName}>{tweak.name}</span>
              </div>
            ))}
          </div>
        </section>

        <p className={s.pending}>
          Os controles ainda estão na tela de cada programa e no fim da Seleção. O próximo passo
          traz todos para cá, e é quando esta tela passa a mandar de verdade. Hoje ela já mostra o
          padrão que está valendo e quantos programas fogem de cada um.
        </p>
      </div>
    </div>
  )
}

export const CONFIG_KEYS = DEFAULT_KEYS
