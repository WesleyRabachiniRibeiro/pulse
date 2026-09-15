import { useState } from 'react'
import { EXPORT_FORMATS, FORMAT_FILE, type ExportFormat, type ImportMode } from '@pulse/domain'
import { applyProfile, selectionAsProfile, useSelection } from '@/features/selection'
import { useCatalog } from '@/features/catalog'
import { bridge } from '@/shared/lib/bridge'
import shell from './Config.module.css'
import s from './ProfileBlock.module.css'

const FORMAT_HINT: Record<ExportFormat, string> = {
  pulse: 'volta para o Pulse em outro PC, com discos e ajustes',
  winget: 'a lista que o winget importa pela linha de comando',
  script: 'um .ps1 que roda sem o Pulse instalado',
  csv: 'para conferir a lista numa planilha',
}

type Note = { kind: 'ok' | 'bad'; text: string } | null

export function ProfileBlock() {
  const catalog = useCatalog()
  const selected = useSelection((st) => st.selected)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note>(null)

  const count = selected.size

  async function exportAs(format: ExportFormat) {
    setBusy(true)
    setNote(null)

    const result = await bridge
      .invoke('profile:export', { format, profile: selectionAsProfile() })
      .catch(() => ({ status: 'failed' as const, path: undefined }))

    setBusy(false)
    if (result.status === 'canceled') return
    setNote(
      result.status === 'saved'
        ? { kind: 'ok', text: `Salvo em ${result.path ?? 'disco'}` }
        : { kind: 'bad', text: 'Não deu para gravar o arquivo.' },
    )
  }

  // O que voltou do main já veio limpo contra o catálogo daqui, então é só
  // aplicar. O que ficou de fora vira aviso, e não silêncio.
  function settle(result: {
    status: string
    profile?: Parameters<typeof applyProfile>[0]
    count?: number
    missing?: string[]
  }) {
    if (result.status === 'canceled') return

    if (result.status !== 'imported' || !result.profile) {
      setNote({
        kind: 'bad',
        text:
          result.status === 'invalid'
            ? 'Esse arquivo não é um perfil do Pulse.'
            : 'Não deu para ler o perfil.',
      })
      return
    }

    applyProfile(result.profile)

    const missing = result.missing ?? []
    const names = missing.map((id) => catalog.byId.get(id)?.name ?? id)
    setNote({
      kind: 'ok',
      text:
        names.length === 0
          ? `${result.count} ${result.count === 1 ? 'programa' : 'programas'} na seleção.`
          : `${result.count} na seleção. Fora do catálogo daqui: ${names.join(', ')}.`,
    })
  }

  async function importFile() {
    setBusy(true)
    setNote(null)
    const result = await bridge
      .invoke('profile:import', { mode, current: selectionAsProfile() })
      .catch(() => ({ status: 'failed' }))
    setBusy(false)
    settle(result)
  }

  async function importLink() {
    if (!url.trim()) return
    setBusy(true)
    setNote(null)
    const result = await bridge
      .invoke('profile:importLink', { url: url.trim(), mode, current: selectionAsProfile() })
      .catch(() => ({ status: 'failed' }))
    setBusy(false)
    settle(result)
  }

  return (
    <section className={shell.section}>
      <div className={shell.header}>
        <span className={shell.name}>LEVAR A SELEÇÃO PARA OUTRO PC</span>
        <span className={shell.line} aria-hidden />
        <span className={shell.scope}>ARQUIVO OU LINK</span>
      </div>

      <p className={shell.note}>
        Guarda o que você escolheu num arquivo, com os discos e os ajustes de cada programa. Serve
        para repetir a mesma instalação em outra máquina, ou para deixar pronto antes de formatar.
      </p>

      <div className={s.formats}>
        {EXPORT_FORMATS.map((format) => (
          <button
            key={format}
            type="button"
            className={s.format}
            disabled={busy || count === 0}
            onClick={() => void exportAs(format)}
          >
            <span className={s.formatName}>{FORMAT_FILE[format].name}</span>
            <span className={s.formatHint}>{FORMAT_HINT[format]}</span>
            <span className={s.formatExt}>.{FORMAT_FILE[format].extension}</span>
          </button>
        ))}
      </div>

      {count === 0 && (
        <p className={s.empty}>Escolha ao menos um programa na etapa de seleção para exportar.</p>
      )}

      <div className={s.importTop}>
        <span className={s.importLabel}>TRAZER DE VOLTA</span>
        <div className={s.modes}>
          {(['merge', 'replace'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={s.mode}
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
            >
              {option === 'merge' ? 'SOMAR À SELEÇÃO' : 'SUBSTITUIR'}
            </button>
          ))}
        </div>
      </div>

      <div className={s.importRow}>
        <button type="button" className={s.primary} disabled={busy} onClick={() => void importFile()}>
          ESCOLHER UM ARQUIVO
        </button>

        <input
          className={s.url}
          value={url}
          placeholder="ou cole um link para um perfil"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void importLink()
          }}
        />
        <button
          type="button"
          className={s.ghost}
          disabled={busy || !url.trim()}
          onClick={() => void importLink()}
        >
          BUSCAR
        </button>
      </div>

      {note && (
        <p className={s.note} data-bad={note.kind === 'bad'} role={note.kind === 'bad' ? 'alert' : undefined}>
          {note.text}
        </p>
      )}
    </section>
  )
}
