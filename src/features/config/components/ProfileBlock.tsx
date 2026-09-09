import { useEffect, useState } from 'react'
import { LuCheck, LuFolder, LuLink } from 'react-icons/lu'
import { EXPORT_FORMATS, type ExportFormat, type ImportMode } from '@shared/domain/portable'
import { savePreference, usePreferences } from '@/features/preferences'
import { useSelection } from '@/features/selection'
import { bridge } from '@/shared/lib/bridge'
import s from './ProfileBlock.module.css'

const FORMATS: Record<ExportFormat, { label: string; hint: string }> = {
  pulse: {
    label: 'Perfil do Pulse',
    hint: 'a lista, o disco de cada um e as exceções. É o que o Pulse importa de volta',
  },
  winget: {
    label: 'Lista do winget',
    hint: 'para rodar winget import em qualquer PC, sem o Pulse',
  },
  script: {
    label: 'Script do PowerShell',
    hint: 'um comando de instalação por programa, para você ler antes de rodar',
  },
  csv: { label: 'Planilha', hint: 'nome, identificador, categoria e tamanho, para consultar' },
}

type Escolha = ImportMode | 'ask'

const MODES: { id: Escolha; label: string }[] = [
  { id: 'ask', label: 'PERGUNTAR' },
  { id: 'merge', label: 'SOMAR' },
  { id: 'replace', label: 'SUBSTITUIR' },
]

interface Folder {
  path: string
  label: string
}

export function ProfileBlock() {
  const prefs = usePreferences()
  const selected = useSelection((st) => st.selected)
  const settings = useSelection((st) => st.settings)

  const [format, setFormat] = useState<ExportFormat>('pulse')
  const [mode, setMode] = useState<Escolha>('ask')
  const [asking, setAsking] = useState(false)
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

  const exceptions = Object.keys(settings).length
  const profileLine =
    selected.size === 0
      ? 'Você ainda não marcou nenhum programa.'
      : `Hoje são ${selected.size} ${selected.size === 1 ? 'programa' : 'programas'}${
          exceptions > 0
            ? ` e ${exceptions} ${exceptions === 1 ? 'exceção' : 'exceções'}`
            : ''
        }.`

  async function exportar() {
    setBusy(true)
    setNote(null)

    const answer = await bridge.invoke('profile:export', { format }).catch(() => null)
    setBusy(false)

    if (!answer || answer.status === 'failed') return setNote('Não deu para salvar o arquivo.')
    if (answer.status === 'canceled') return
    setNote(`Salvo em ${answer.path}`)
  }

  async function importar(escolha: ImportMode) {
    setAsking(false)
    setBusy(true)
    setNote(null)

    const answer = await bridge.invoke('profile:import', { mode: escolha }).catch(() => null)
    setBusy(false)
    contar(answer)
  }

  async function importarLink(escolha: ImportMode) {
    setAsking(false)
    setBusy(true)
    setNote(null)

    const answer = await bridge
      .invoke('profile:importLink', { url: link, mode: escolha })
      .catch(() => null)
    setBusy(false)
    contar(answer)
  }

  function contar(answer: { status: string; count?: number } | null) {
    if (!answer || answer.status === 'failed') return setNote('Não deu para ler esse perfil.')
    if (answer.status === 'canceled') return
    if (answer.status === 'invalid') {
      return setNote('Esse arquivo não é um perfil do Pulse, ou é de uma versão que não conheço.')
    }

    const many = answer.count ?? 0
    setNote(
      `${many} ${many === 1 ? 'programa marcado' : 'programas marcados'}. Reabra o Pulse para a Seleção pegar a lista nova.`,
    )
  }

  const [pending, setPending] = useState<'file' | 'link' | null>(null)

  function começar(from: 'file' | 'link') {
    if (mode === 'ask') {
      setPending(from)
      setAsking(true)
      return
    }
    if (from === 'file') void importar(mode)
    else void importarLink(mode)
  }

  function resolver(escolha: ImportMode) {
    if (pending === 'link') void importarLink(escolha)
    else void importar(escolha)
  }

  async function escolherPasta() {
    const chosen = await bridge.invoke('profile:pickFolder', undefined).catch(() => null)
    if (chosen) void savePreference({ profileFolder: chosen })
  }

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

            <button type="button" className={s.primary} disabled={busy} onClick={() => void exportar()}>
              Salvar arquivo…
            </button>
          </div>

          <div className={s.options}>
            {EXPORT_FORMATS.map((one) => (
              <button
                key={one}
                type="button"
                className={s.option}
                aria-pressed={format === one}
                onClick={() => setFormat(one)}
              >
                <span className={s.mark} aria-hidden>
                  {format === one ? <LuCheck size={12} /> : null}
                </span>
                <span className={s.optionTexts}>
                  <span className={s.optionName}>{FORMATS[one].label}</span>
                  <span className={s.optionHint}>{FORMATS[one].hint}</span>
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
                O que fazer com os {selected.size} que você já tinha marcado?
              </span>
              <button type="button" className={s.secondary} onClick={() => resolver('merge')}>
                Somar as duas listas
              </button>
              <button type="button" className={s.secondary} onClick={() => resolver('replace')}>
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
          <div className={s.hint}>Cole o endereço de um perfil que alguém compartilhou com você.</div>

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
          <div className={s.hint}>
            {prefs.profileFolder
              ? `Salvar e abrir começam em ${prefs.profileFolder}.`
              : 'Escolha onde salvar e abrir os perfis. Uma pasta que já sincroniza sozinha faz o arquivo viajar entre os seus PCs, sem login nenhum.'}
          </div>

          <div className={s.options}>
            {folders.map((one) => (
              <button
                key={one.path}
                type="button"
                className={s.option}
                aria-pressed={prefs.profileFolder === one.path}
                onClick={() => void savePreference({ profileFolder: one.path })}
              >
                <span className={s.mark} aria-hidden>
                  {prefs.profileFolder === one.path ? <LuCheck size={12} /> : null}
                </span>
                <span className={s.optionTexts}>
                  <span className={s.optionName}>{one.label}</span>
                  <span className={s.optionHint}>{one.path}</span>
                </span>
              </button>
            ))}

            <button type="button" className={s.option} onClick={() => void escolherPasta()}>
              <span className={s.mark} aria-hidden>
                <LuFolder size={12} />
              </span>
              <span className={s.optionTexts}>
                <span className={s.optionName}>Outra pasta…</span>
                <span className={s.optionHint}>pendrive, ou qualquer pasta deste PC</span>
              </span>
            </button>
          </div>
        </div>

        {note && <p className={s.note}>{note}</p>}
      </div>
    </section>
  )
}
