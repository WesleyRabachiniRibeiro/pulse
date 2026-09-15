import { useState } from 'react'
import { LuLink } from 'react-icons/lu'
import {
  EXPORT_FORMATS,
  FORMAT_FILE,
  formatMb,
  type ExportFormat,
  type ImportMode,
} from '@pulse/domain'
import { totalSizeMb } from '@pulse/utils'
import { applyProfile, selectionAsProfile, useSelection } from '@/features/selection'
import { useCatalog } from '@/features/catalog'
import { bridge } from '@/shared/lib/bridge'
import s from './ProfileBlock.module.css'

const FORMATS: Record<ExportFormat, { label: string; hint: string }> = {
  pulse: { label: 'Perfil do Pulse', hint: '.json — traz de volta tudo, inclusive as exceções' },
  winget: { label: 'JSON do winget', hint: '.json — o formato que o winget import lê' },
  script: { label: 'Script de linha de comando', hint: '.ps1 — roda sem o Pulse instalado' },
  csv: { label: 'Planilha da lista', hint: '.csv — só os nomes, para conferir ou imprimir' },
}

// 'ask' não é um modo de importação, é não ter escolhido ainda: a pergunta
// aparece na hora, com a contagem do que já estava marcado.
type Choice = ImportMode | 'ask'

const MODES: readonly { id: Choice; label: string }[] = [
  { id: 'replace', label: 'Substituir' },
  { id: 'merge', label: 'Somar' },
  { id: 'ask', label: 'Perguntar na hora' },
]

interface Answer {
  status: string
  profile?: Parameters<typeof applyProfile>[0]
  count?: number
  missing?: string[]
}

export function ProfileBlock() {
  const catalog = useCatalog()
  const selected = useSelection((st) => st.selected)
  const settings = useSelection((st) => st.settings)

  const [format, setFormat] = useState<ExportFormat>('pulse')
  const [mode, setMode] = useState<Choice>('ask')
  const [asking, setAsking] = useState(false)
  const [pending, setPending] = useState<'file' | 'link'>('file')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const many = selected.size
  const exceptions = Object.keys(settings).length
  const profileLine = [
    `${many} ${many === 1 ? 'programa marcado' : 'programas marcados'}`,
    formatMb(totalSizeMb(catalog, selected)),
    exceptions === 0
      ? 'nenhuma exceção'
      : `${exceptions} ${exceptions === 1 ? 'exceção' : 'exceções'}`,
  ].join(' · ')

  async function exportAs() {
    setBusy(true)
    setNote(null)

    const answer = await bridge
      .invoke('profile:export', { format, profile: selectionAsProfile() })
      .catch(() => null)

    setBusy(false)
    if (!answer || answer.status === 'failed') return setNote('Não deu para salvar o arquivo.')
    if (answer.status === 'canceled') return
    setNote(`Salvo em ${answer.path ?? 'disco'}`)
  }

  // O que voltou do main já veio limpo contra o catálogo daqui, então é só
  // aplicar. O que ficou de fora vira aviso, e não silêncio.
  function settle(answer: Answer | null) {
    if (!answer || answer.status === 'failed') return setNote('Não deu para ler esse perfil.')
    if (answer.status === 'canceled') return

    if (answer.status !== 'imported' || !answer.profile) {
      return setNote(
        'Esse arquivo não é um perfil do Pulse, ou é de uma versão que não conheço.',
      )
    }

    applyProfile(answer.profile)

    const count = answer.count ?? 0
    const names = (answer.missing ?? []).map((id) => catalog.byId.get(id)?.name ?? id)

    setNote(
      [
        `${count} ${count === 1 ? 'programa marcado' : 'programas marcados'}`,
        names.length > 0 ? `fora do catálogo daqui: ${names.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    )
  }

  async function bring(choice: ImportMode, from: 'file' | 'link') {
    setAsking(false)
    setBusy(true)
    setNote(null)

    const answer = await (from === 'link'
      ? bridge.invoke('profile:importLink', {
          url: link.trim(),
          mode: choice,
          current: selectionAsProfile(),
        })
      : bridge.invoke('profile:import', { mode: choice, current: selectionAsProfile() })
    ).catch(() => null)

    setBusy(false)
    settle(answer)
  }

  function begin(from: 'file' | 'link') {
    setPending(from)
    if (mode === 'ask') return setAsking(true)
    void bring(mode, from)
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

            <button
              type="button"
              className={s.primary}
              disabled={busy || many === 0}
              onClick={() => void exportAs()}
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
              onClick={() => begin('file')}
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
                onClick={() => void bring('merge', pending)}
              >
                Somar as duas listas
              </button>
              <button
                type="button"
                className={s.secondary}
                onClick={() => void bring('replace', pending)}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && link.trim()) begin('link')
                }}
                placeholder="https://…"
                aria-label="Endereço do perfil"
              />
            </div>

            <button
              type="button"
              className={s.secondary}
              disabled={busy || link.trim().length === 0}
              onClick={() => begin('link')}
            >
              Importar
            </button>
          </div>
        </div>

        {note && <p className={s.note}>{note}</p>}
      </div>
    </section>
  )
}
