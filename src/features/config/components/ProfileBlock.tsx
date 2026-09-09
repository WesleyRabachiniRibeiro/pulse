import { useEffect, useState } from 'react'
import { LuLink } from 'react-icons/lu'
import { formatMb, totalSizeMb } from '@shared/domain/catalog'
import {
  EXPORT_FORMATS,
  FORMAT_FILE,
  type ExportFormat,
  type ImportMode,
} from '@shared/domain/portable'
import { savePreference, usePreferences } from '@/features/preferences'
import { useSelection } from '@/features/selection'
import { bridge } from '@/shared/lib/bridge'
import s from './ProfileBlock.module.css'

const FORMATS: Record<ExportFormat, { label: string; hint: string }> = {
  pulse: { label: 'Perfil do Pulse', hint: '.json — traz de volta tudo, inclusive as exceções' },
  winget: { label: 'JSON do winget', hint: '.json — o formato que o winget import lê' },
  script: { label: 'Script de linha de comando', hint: '.ps1 — roda sem o Pulse instalado' },
  csv: { label: 'Planilha da lista', hint: '.csv — só os nomes, para conferir ou imprimir' },
}

type Escolha = ImportMode | 'ask'

const MODES: { id: Escolha; label: string }[] = [
  { id: 'replace', label: 'Substituir' },
  { id: 'merge', label: 'Somar' },
  { id: 'ask', label: 'Perguntar na hora' },
]

interface Folder {
  path: string
  label: string
}

interface Answer {
  status: string
  count?: number
}

export function ProfileBlock() {
  const prefs = usePreferences()
  const selected = useSelection((st) => st.selected)
  const settings = useSelection((st) => st.settings)

  const [format, setFormat] = useState<ExportFormat>('pulse')
  const [mode, setMode] = useState<Escolha>('ask')
  const [asking, setAsking] = useState(false)
  const [pending, setPending] = useState<'file' | 'link'>('file')
  const [link, setLink] = useState('')
  const [folders, setFolders] = useState<Folder[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void bridge
      .invoke('profile:folders', undefined)
      .then((found) => {
        if (alive) setFolders(found)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  const many = selected.size
  const exceptions = Object.keys(settings).length
  const profileLine = [
    `${many} ${many === 1 ? 'programa marcado' : 'programas marcados'}`,
    formatMb(totalSizeMb(selected)),
    exceptions === 0
      ? 'nenhuma exceção'
      : `${exceptions} ${exceptions === 1 ? 'exceção' : 'exceções'}`,
  ].join(' · ')

  function contar(answer: Answer | null) {
    if (!answer || answer.status === 'failed') return setNote('Não deu para ler esse perfil.')
    if (answer.status === 'canceled') return
    if (answer.status === 'invalid') {
      return setNote('Esse arquivo não é um perfil do Pulse, ou é de uma versão que não conheço.')
    }

    const count = answer.count ?? 0
    setNote(
      `${count} ${count === 1 ? 'programa marcado' : 'programas marcados'}. Reabra o Pulse para a Seleção pegar a lista nova.`,
    )
  }

  async function exportar() {
    setBusy(true)
    setNote(null)

    const answer = await bridge.invoke('profile:export', { format }).catch(() => null)
    setBusy(false)

    if (!answer || answer.status === 'failed') return setNote('Não deu para salvar o arquivo.')
    if (answer.status === 'canceled') return
    setNote(`Salvo em ${answer.path}`)
  }

  async function trazer(escolha: ImportMode, from: 'file' | 'link') {
    setAsking(false)
    setBusy(true)
    setNote(null)

    const answer = await (from === 'link'
      ? bridge.invoke('profile:importLink', { url: link, mode: escolha })
      : bridge.invoke('profile:import', { mode: escolha })
    ).catch(() => null)

    setBusy(false)
    contar(answer)
  }

  function começar(from: 'file' | 'link') {
    setPending(from)
    if (mode === 'ask') return setAsking(true)
    void trazer(mode, from)
  }

  async function escolherPasta() {
    const chosen = await bridge.invoke('profile:pickFolder', undefined).catch(() => null)
    if (chosen) void savePreference({ profileFolder: chosen })
  }

  const folderNote = prefs.profileFolder
    ? `Salvar e abrir começam em ${prefs.profileFolder}.`
    : 'Sem pasta escolhida, o perfil só sai quando você clicar em salvar.'

  return (
    <section className={s.section}>
      <div className={s.header}>
        <span className={s.name}>PERFIL DESTE PC</span>
        <span className={s.line} aria-hidden />
        <span className={s.scope}>ARQUIVO NO SEU PC, NÃO CONTA NA NUVEM</span>
      </div>

      <div className={s.cards}>
        <div className={s.card}>
          <div className={s.top}>
            <div className={s.texts}>
              <div className={s.cardName}>Exportar o perfil</div>
              <div className={s.hint}>
                A lista marcada, o disco de cada programa e as exceções de cada um. {profileLine}
              </div>
            </div>

            <button
              type="button"
              className={s.primary}
              disabled={busy}
              onClick={() => void exportar()}
            >
              Salvar .{FORMAT_FILE[format].extension}…
            </button>
          </div>

          <div className={s.picks}>
            {EXPORT_FORMATS.map((one) => (
              <button
                key={one}
                type="button"
                className={s.pick}
                aria-pressed={format === one}
                onClick={() => setFormat(one)}
              >
                <span className={s.dot} aria-hidden />
                <span className={s.pickTexts}>
                  <span className={s.pickName}>{FORMATS[one].label}</span>
                  <span className={s.pickHint}>{FORMATS[one].hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className={s.card}>
          <div className={s.top}>
            <div className={s.texts}>
              <div className={s.cardName}>Importar um perfil de arquivo</div>
              <div className={s.hint}>O que fazer com os programas que você já tinha marcado.</div>
            </div>

            <div className={s.modes}>
              {MODES.map((one) => (
                <button
                  key={one.id}
                  type="button"
                  className={s.mode}
                  aria-pressed={mode === one.id}
                  onClick={() => setMode(one.id)}
                >
                  {one.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={s.secondary}
              disabled={busy}
              onClick={() => começar('file')}
            >
              Escolher arquivo…
            </button>
          </div>

          {asking && (
            <div className={s.ask}>
              <span className={s.askLine}>
                O que fazer com os {many} que você já tinha marcado?
              </span>
              <button
                type="button"
                className={s.secondary}
                onClick={() => void trazer('merge', pending)}
              >
                Somar as duas listas
              </button>
              <button
                type="button"
                className={s.secondary}
                onClick={() => void trazer('replace', pending)}
              >
                Substituir pela do arquivo
              </button>
              <button
                type="button"
                className={s.close}
                aria-label="Cancelar"
                onClick={() => setAsking(false)}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div className={s.card}>
          <div className={s.cardName}>Importar de um link</div>
          <div className={s.hint}>
            Cole o endereço de um perfil que alguém compartilhou com você.
          </div>

          <div className={s.linkRow}>
            <div className={s.field}>
              <LuLink size={14} className={s.fieldIcon} aria-hidden />
              <input
                className={s.input}
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
                aria-label="Endereço do perfil"
              />
            </div>

            <button
              type="button"
              className={s.secondary}
              disabled={busy || link.trim().length === 0}
              onClick={() => começar('link')}
            >
              Importar
            </button>
          </div>
        </div>

        <div className={s.card}>
          <div className={s.cardName}>Pasta sincronizada</div>
          <div className={s.hint}>{folderNote}</div>

          <div className={s.picks}>
            <button
              type="button"
              className={s.pick}
              aria-pressed={!prefs.profileFolder}
              onClick={() => void savePreference({ profileFolder: undefined })}
            >
              <span className={s.dot} aria-hidden />
              <span className={s.pickTexts}>
                <span className={s.pickName}>Nenhuma</span>
                <span className={s.pickHint}>só salvar quando eu pedir</span>
              </span>
            </button>

            {folders.map((one) => (
              <button
                key={one.path}
                type="button"
                className={s.pick}
                aria-pressed={prefs.profileFolder === one.path}
                onClick={() => void savePreference({ profileFolder: one.path })}
                title={one.path}
              >
                <span className={s.dot} aria-hidden />
                <span className={s.pickTexts}>
                  <span className={s.pickName}>{one.label}</span>
                  <span className={s.pickHint}>detectado neste PC</span>
                </span>
              </button>
            ))}

            <button type="button" className={s.pick} onClick={() => void escolherPasta()}>
              <span className={s.dot} aria-hidden />
              <span className={s.pickTexts}>
                <span className={s.pickName}>Pendrive ou outra pasta</span>
                <span className={s.pickHint}>você escolhe na hora</span>
              </span>
            </button>
          </div>
        </div>

        {note && <p className={s.note}>{note}</p>}
      </div>
    </section>
  )
}
