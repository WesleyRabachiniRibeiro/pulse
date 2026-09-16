import { useState } from 'react'
import {
  DEFAULT_KEYS,
  defaultLabel,
  formatGb,
  LOCALES,
  overriddenKeys,
  type DefaultKey,
  type Defaults,
  type Drive,
  type Settings,
} from '@pulse/domain'
import { ConfigRow, type Choice } from '@/shared/ui/ConfigRow/ConfigRow'
import s from './ProgramExceptions.module.css'

const NAME: Record<DefaultKey, string> = {
  scope: 'Instalar para quem',
  locale: 'Idioma',
  interactive: 'Janela do instalador',
  desktopShortcut: 'Atalho na área de trabalho',
  autostart: 'Abrir com o Windows',
}

const CHOICES: Record<DefaultKey, readonly Choice[]> = {
  scope: [
    { id: 'user', label: 'SÓ PARA MIM' },
    { id: 'machine', label: 'PARA TODOS' },
  ],
  locale: LOCALES.map((locale) => ({ id: locale.id, label: locale.name.toUpperCase() })),
  interactive: [
    { id: 'false', label: 'EM SILÊNCIO' },
    { id: 'true', label: 'MOSTRAR' },
  ],
  desktopShortcut: [
    { id: 'true', label: 'CRIAR' },
    { id: 'false', label: 'NÃO CRIAR' },
  ],
  autostart: [
    { id: 'true', label: 'ABRIR' },
    { id: 'false', label: 'NÃO ABRIR' },
  ],
}

function valueFor(key: DefaultKey, picked: string): Settings[DefaultKey] {
  if (key === 'scope') return picked === 'machine' ? 'machine' : 'user'
  if (key === 'locale') return picked
  return picked === 'true'
}

interface Props {
  settings: Settings
  defaults: Defaults
  drives: readonly Drive[]
  generalDrive: string
  chosenDrive: string | null
  currentAutostart: 'on' | 'off' | null
  installed: boolean
  onChangeSettings: (settings: Settings) => void
  onChangeDrive: (drive: string | null) => void
}

export function ProgramExceptions({
  settings,
  defaults,
  drives,
  generalDrive,
  chosenDrive,
  currentAutostart,
  installed,
  onChangeSettings,
  onChangeDrive,
}: Props) {
  const [open, setOpen] = useState(false)

  const straying = overriddenKeys(settings, defaults)
  const driveStrays = chosenDrive !== null && chosenDrive !== generalDrive
  const total = straying.length + (driveStrays ? 1 : 0)

  function pick(key: DefaultKey, picked: string): void {
    const next: Settings = { ...settings }
    const value = valueFor(key, picked)

    if (value === defaults[key]) delete next[key]
    else Object.assign(next, { [key]: value })

    onChangeSettings(next)
  }

  function hintFor(key: DefaultKey): string | undefined {
    if (key !== 'autostart') return undefined
    return currentAutostart
      ? `hoje neste PC: ${currentAutostart === 'on' ? 'abre' : 'não abre'} com o Windows`
      : 'este programa não se cadastra para abrir sozinho hoje'
  }

  return (
    <section className={s.block} data-open={open} data-tour="aj-excecoes">
      <button type="button" className={s.summary} onClick={() => setOpen((v) => !v)}>
        <span className={s.summaryText}>
          <span className={s.label}>EXCEÇÕES PARA ESTE PROGRAMA</span>
          <span className={s.line} data-exception={total > 0}>
            {total > 0
              ? `${total} ${total === 1 ? 'exceção' : 'exceções'} · o resto segue a Configuração`
              : 'Nada por aqui, segue tudo da Configuração'}
          </span>
        </span>
        <span className={s.action}>{open ? 'FECHAR' : 'ABRIR'}</span>
      </button>

      {open && (
        <div className={s.rows}>
          <ConfigRow
            name="Disco onde instalar"
            tag={driveStrays ? 'EXCEÇÃO DESTE PROGRAMA' : `PADRÃO: ${generalDrive.toUpperCase()}`}
            exception={driveStrays}
            choices={drives.map((drive) => ({
              id: drive.letter,
              label: `${drive.letter} · ${formatGb(drive.freeBytes)} LIVRES`,
            }))}
            chosen={chosenDrive ?? generalDrive}
            busy={drives.length === 0 || installed}
            onPick={(letter) => onChangeDrive(letter === generalDrive ? null : letter)}
          />

          {DEFAULT_KEYS.map((key) => {
            const strays = straying.includes(key)
            const chosen = settings[key] ?? defaults[key]

            return (
              <ConfigRow
                key={key}
                name={NAME[key]}
                {...(hintFor(key) ? { hint: hintFor(key) } : {})}
                tag={
                  strays
                    ? 'EXCEÇÃO DESTE PROGRAMA'
                    : `PADRÃO: ${defaultLabel(key, defaults).toUpperCase()}`
                }
                exception={strays}
                choices={CHOICES[key]}
                chosen={chosen === undefined ? '' : String(chosen)}
                onPick={(picked) => pick(key, picked)}
              />
            )
          })}

          <p className={s.note}>
            Escolher o mesmo que a Configuração apaga a exceção. Para mudar de uma vez para todos
            os programas, use a tela de Configuração.
          </p>
        </div>
      )}
    </section>
  )
}
