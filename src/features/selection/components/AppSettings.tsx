import { useEffect, useMemo, useState } from 'react'
import { LuSearch } from 'react-icons/lu'
import {
  categoriesOf,
  DEFAULT_GIT,
  optionsFor,
  settingsAreEmpty,
  type GitConfig,
  type Settings,
} from '@shared/domain/settings'
import { formatMb, type Program } from '@shared/domain/catalog'
import { formatGb, type Drive } from '@shared/domain/preflight'
import type { SteamGame } from '@shared/domain/steam'
import { bridge } from '@/shared/lib/bridge'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import s from './AppSettings.module.css'
import { SteamGames } from './SteamGames'
import { PackageVersions } from './PackageVersions'

interface Props {
  program: Program
  installed: boolean
  drives: readonly Drive[]
  generalDrive: string
  chosenDrive: string | null
  currentAutostart: 'on' | 'off' | null
  settings: Settings
  onChangeDrive: (id: string, drive: string | null) => void
  onChangeSettings: (id: string, settings: Settings) => void
  onUninstalled: () => void
  onApplyNow: () => void
  onBack: () => void
}

const TITLE: Record<string, string> = {
  vscode: 'EXTENSÕES PARA INSTALAR JUNTO',
  steam: 'JOGOS PARA BAIXAR DEPOIS',
  git: 'COMO ASSINAR SEUS COMMITS',
  tibia: 'QUAIS TIBIAS VOCÊ QUER',
  riot: 'JOGOS PARA INSTALAR JUNTO',
  vs: 'LINGUAGENS PARA INSTALAR',
  browser: 'QUANDO A INSTALAÇÃO TERMINAR',
}

const DESCRIPTION: Record<string, string> = {
  vscode:
    'Marcadas aqui, elas entram sozinhas assim que o VS Code terminar de instalar. Dá para mudar de ideia depois, dentro do próprio editor.',
  steam:
    'A Steam só baixa com a sua conta conectada. Na hora de instalar, o app espera você entrar e depois abre o pedido de cada jogo, que você confirma na janela dela.',
  git: 'É o nome e o email que aparecem em cada commit seu. Os campos já vêm com o que está cadastrado nesta máquina, lido na hora. Mude só o que quiser mudar: o que você não tocar continua como está.',
  browser:
    'O Windows não deixa um programa se tornar o navegador padrão sozinho, e faz bem. O Pulse pede ao próprio navegador, que ou se define, ou abre a tela do Windows para você confirmar. No fim o resumo diz qual dos dois aconteceu.',
  vs:
    'O Visual Studio não instala linguagens soltas, instala cargas de trabalho. Marque as que você usa e elas entram junto, na mesma instalação. C e C++ vêm na mesma carga, porque compartilham o compilador.',
  riot:
    'Entram logo depois do cliente da Riot, um de cada vez, no mesmo disco que você escolheu. O League of Legends já vem com o cliente, e o Teamfight Tactics vem dentro dele.',
  tibia:
    'Cada Tibia tem o seu próprio cliente, baixado do site de quem faz o servidor. O Pulse abre a página oficial dos que você marcar, uma de cada vez, e você baixa e instala de lá. Ele não baixa esses arquivos sozinho porque não há como conferir se veio o que devia.',
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function AppSettings({
  program,
  installed,
  drives,
  generalDrive,
  chosenDrive,
  currentAutostart,
  settings,
  onChangeDrive,
  onChangeSettings,
  onUninstalled,
  onApplyNow,
  onBack,
}: Props) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Tudo')
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gitDaMaquina, setGitDaMaquina] = useState<GitConfig | null>(null)

  const kind = program.settingsKind

  useEffect(() => {
    if (kind !== 'git') return
    let vivo = true
    void bridge
      .invoke('git:config', undefined)
      .then((c) => {
        if (vivo) setGitDaMaquina(c)
      })
      .catch(() => {
        if (vivo) setGitDaMaquina(DEFAULT_GIT)
      })
    return () => {
      vivo = false
    }
  }, [kind])
  const installsItself = program.source !== 'pages'
  const options = kind ? optionsFor(kind) : []
  const categories = useMemo(() => categoriesOf(options), [options])

  const term = normalize(search.trim())
  const visible = options.filter(
    (o) =>
      (filter === 'Tudo' || o.category === filter) && (!term || normalize(o.name).includes(term)),
  )

  const picksClients = kind === 'tibia'
  const picksGames = kind === 'riot'
  const picksWorkloads = kind === 'vs'
  const checked: readonly string[] =
    (picksClients
      ? settings.tibia
      : picksGames
        ? settings.riot
        : picksWorkloads
          ? settings.workloads
          : settings.extensions) ?? []

  const autostartShown: 'on' | 'off' | null =
    settings.autostart === undefined ? currentAutostart : settings.autostart ? 'on' : 'off'

  function chooseAutostart(wanted: 'on' | 'off') {
    const value = wanted === currentAutostart ? undefined : wanted === 'on'
    onChangeSettings(program.id, { ...settings, autostart: value })
  }
  const git: GitConfig = settings.git ?? gitDaMaquina ?? DEFAULT_GIT
  const canApply = installed && !settingsAreEmpty(settings)

  function toggleOption(id: string) {
    const next = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id]
    onChangeSettings(
      program.id,
      picksClients
        ? { ...settings, tibia: next }
        : picksGames
          ? { ...settings, riot: next }
          : picksWorkloads
            ? { ...settings, workloads: next }
            : { ...settings, extensions: next },
    )
  }

  function toggleGame(game: SteamGame) {
    const current = settings.games ?? []
    const next = current.some((g) => g.appid === game.appid)
      ? current.filter((g) => g.appid !== game.appid)
      : [...current, game]
    onChangeSettings(program.id, { ...settings, games: next })
  }

  function changeGit(field: keyof GitConfig, value: string) {
    onChangeSettings(program.id, { ...settings, git: { ...git, [field]: value } })
  }

  async function remove() {
    setError(null)
    setRemoving(true)
    try {
      const r = await bridge.invoke('installation:uninstall', { id: program.id })
      setConfirming(false)

      if (r.verified) {
        setRemoved(true)
        onUninstalled()
        return
      }

      setError(r.error ?? 'Não foi possível desinstalar.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível desinstalar.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className={s.screen}>
      <header className={s.top}>
        <button type="button" className={s.back} data-tour="aj-voltar" onClick={onBack}>
          ← VOLTAR PARA A SELEÇÃO
        </button>

        <div className={s.identity}>
          <AppIcon id={program.id} name={program.name} size={52} />
          <div>
            <h2 className={s.title}>{program.name}</h2>
            <div className={s.meta}>
              {installsItself
                ? `${program.version} · ${formatMb(program.mb)} · ${installed ? 'já está no seu PC' : `vai para ${chosenDrive ?? generalDrive}`}`
                : 'o app abre a página oficial de cada um que você marcar'}
            </div>
          </div>
        </div>
      </header>

      <div className={s.body}>
        {program.notice && (
          <section className={s.section}>
            <div className={s.label}>ANTES DE INSTALAR</div>
            <p className={s.description}>{program.notice}</p>
          </section>
        )}

        {installsItself && (
        <section className={s.section} data-tour="aj-disco">
          <div className={s.label}>ONDE INSTALAR ESTE PROGRAMA</div>
          <p className={s.description}>
            Vale só para o {program.name}. Os outros seguem o disco geral, escolhido nas
            boas-vindas.
          </p>

          <div className={s.drives}>
            <button
              type="button"
              className={s.drive}
              aria-pressed={chosenDrive === null}
              disabled={installed}
              onClick={() => onChangeDrive(program.id, null)}
            >
              <span className={s.driveName}>Geral · {generalDrive}</span>
              <span className={s.driveNote}>o disco da etapa 1</span>
            </button>

            {drives.map((d) => (
              <button
                key={d.letter}
                type="button"
                className={s.drive}
                aria-pressed={chosenDrive === d.letter}
                disabled={installed}
                onClick={() => onChangeDrive(program.id, d.letter === generalDrive ? null : d.letter)}
              >
                <span className={s.driveName}>
                  {d.letter} {d.label || 'Sem nome'}
                </span>
                <span className={s.driveNote}>
                  {formatGb(d.freeBytes)} livres
                  {d.media !== 'Desconhecido' ? ` · ${d.media}` : ''}
                </span>
              </button>
            ))}
          </div>
        </section>
        )}

        {program.family && (
          <section className={s.section}>
            <div className={s.label}>QUAL VERSÃO INSTALAR</div>
            <p className={s.description}>
              O {program.name} existe em várias versões que convivem na mesma máquina. A lista vem
              do próprio winget, então está sempre atual.
            </p>

            <PackageVersions
              id={program.id}
              chosen={settings.packageId ?? null}
              onChoose={(packageId) =>
                onChangeSettings(program.id, {
                  ...settings,
                  ...(packageId ? { packageId } : { packageId: undefined }),
                })
              }
            />
          </section>
        )}

        {installsItself && (
        <section className={s.section} data-tour="aj-inicio">
          <div className={s.label}>AO LIGAR O COMPUTADOR</div>
          <p className={s.description}>
            {currentAutostart
              ? 'Já está marcado como está hoje no seu PC. É o mesmo interruptor da aba Inicializar do Gerenciador de Tarefas, então dá para conferir e desfazer por lá.'
              : 'Este programa não se cadastra para abrir sozinho hoje. Se ele passar a se cadastrar depois de instalado, a sua escolha aqui vale.'}
          </p>

          <div className={s.drives}>
            {[
              { value: 'on' as const, name: 'Abrir com o Windows', note: 'já pronto quando o PC liga' },
              { value: 'off' as const, name: 'Não abrir com o Windows', note: 'você abre quando quiser' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={s.drive}
                aria-pressed={autostartShown === option.value}
                onClick={() => chooseAutostart(option.value)}
              >
                <span className={s.driveName}>{option.name}</span>
                <span className={s.driveNote}>
                  {option.note}
                  {currentAutostart === option.value ? ' · é o que está agora' : ''}
                </span>
              </button>
            ))}
          </div>
        </section>
        )}

        {kind === 'steam' && (
          <section className={s.section} data-tour="aj-kind">
            <div className={s.label}>{TITLE.steam}</div>
            <p className={s.description}>{DESCRIPTION.steam}</p>
            <SteamGames chosen={settings.games ?? []} onToggle={toggleGame} />
          </section>
        )}

        {(kind === 'vscode' || kind === 'tibia' || kind === 'riot' || kind === 'vs') && (
          <section className={s.section} data-tour="aj-kind">
            <div className={s.label}>{TITLE[kind]}</div>
            <p className={s.description}>{DESCRIPTION[kind]}</p>

            <div className={s.search}>
              <LuSearch className={s.magnifier} size={15} aria-hidden />
              <input
                className={s.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  picksClients
                    ? 'Buscar um Tibia…'
                    : picksGames
                      ? 'Buscar um jogo…'
                      : picksWorkloads
                        ? 'Buscar uma linguagem…'
                        : 'Buscar extensão…'
                }
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
                  <button
                    key={o.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked.includes(o.id)}
                    className={s.option}
                    onClick={() => toggleOption(o.id)}
                  >
                    <span className={s.box} aria-hidden>
                      {checked.includes(o.id) ? '✓' : ''}
                    </span>
                    <span className={s.optionBody}>
                      <span className={s.optionName}>{o.name}</span>
                      <span className={s.optionHint}>{o.hint}</span>
                    </span>
                    <span className={s.optionCategory}>{o.category}</span>
                  </button>
                ))
              )}
            </div>
          </section>
        )}

        {kind === 'browser' && (
          <section className={s.section} data-tour="aj-kind">
            <div className={s.label}>{TITLE.browser}</div>
            <p className={s.description}>{DESCRIPTION.browser}</p>

            <div className={s.options}>
              <button
                type="button"
                role="checkbox"
                aria-checked={settings.makeDefault === true}
                className={s.option}
                onClick={() =>
                  onChangeSettings(program.id, { ...settings, makeDefault: !settings.makeDefault })
                }
              >
                <span className={s.box} aria-hidden>
                  {settings.makeDefault ? '✓' : ''}
                </span>
                <span className={s.optionBody}>
                  <span className={s.optionName}>Deixar como navegador padrão</span>
                  <span className={s.optionHint}>
                    se você marcar mais de um, vale o último que terminar de instalar
                  </span>
                </span>
                <span className={s.optionCategory}>PADRÃO</span>
              </button>

              <button
                type="button"
                role="checkbox"
                aria-checked={settings.openAfter === true}
                className={s.option}
                onClick={() =>
                  onChangeSettings(program.id, { ...settings, openAfter: !settings.openAfter })
                }
              >
                <span className={s.box} aria-hidden>
                  {settings.openAfter ? '✓' : ''}
                </span>
                <span className={s.optionBody}>
                  <span className={s.optionName}>Abrir no fim para importar meus dados</span>
                  <span className={s.optionHint}>
                    o Firefox abre direto no assistente de importação; os outros abrem normalmente
                    e oferecem isso na primeira execução
                  </span>
                </span>
                <span className={s.optionCategory}>DADOS</span>
              </button>
            </div>

            <p className={s.description}>
              Quem importa é o navegador, não o Pulse. Senha fica cifrada com uma chave que
              só quem gravou possui, então ninguém de fora consegue trazer isso corretamente. O
              assistente do Firefox traz favoritos, senhas, histórico, extensões e preenchimento
              automático. Nada dos seus perfis é tocado por aqui.
            </p>
          </section>
        )}

        {kind === 'git' && (
          <section className={s.section} data-tour="aj-kind">
            <div className={s.label}>{TITLE.git}</div>
            <p className={s.description}>{DESCRIPTION.git}</p>

            <div className={s.fields}>
              <label className={s.fieldBlock}>
                <span className={s.fieldLabel}>SEU NOME</span>
                <input
                  className={s.input}
                  value={git.name}
                  onChange={(e) => changeGit('name', e.target.value)}
                  placeholder="Maria Silva"
                />
                <span className={s.fieldHint}>aparece como autor de cada commit</span>
              </label>

              <label className={s.fieldBlock}>
                <span className={s.fieldLabel}>SEU EMAIL</span>
                <input
                  className={s.input}
                  value={git.email}
                  onChange={(e) => changeGit('email', e.target.value)}
                  placeholder="maria@exemplo.com"
                />
                <span className={s.fieldHint}>use o mesmo do GitHub para os commits contarem</span>
              </label>

              <label className={s.fieldBlock}>
                <span className={s.fieldLabel}>BRANCH INICIAL</span>
                <input
                  className={s.input}
                  value={git.branch}
                  onChange={(e) => changeGit('branch', e.target.value)}
                  placeholder="main"
                />
                <span className={s.fieldHint}>o nome do primeiro branch de todo repositório novo</span>
              </label>
            </div>

            <div className={s.options}>
              <button
                type="button"
                role="checkbox"
                aria-checked={git.saveLogin === true}
                className={s.option}
                onClick={() =>
                  onChangeSettings(program.id, {
                    ...settings,
                    git: { ...git, saveLogin: !git.saveLogin },
                  })
                }
              >
                <span className={s.box} aria-hidden>
                  {git.saveLogin ? '✓' : ''}
                </span>
                <span className={s.optionBody}>
                  <span className={s.optionName}>Guardar o login do GitHub</span>
                  <span className={s.optionHint}>
                    no primeiro push o GitHub abre no navegador, você entra por lá e o Windows
                    lembra dali em diante
                  </span>
                </span>
                <span className={s.optionCategory}>CONTA</span>
              </button>
            </div>

            <p className={s.description}>
              O Pulse não pede nem guarda a sua senha. Ele só liga o gerenciador de
              credenciais que já vem com o Git para Windows, e quem cuida do login é o próprio
              GitHub, na janela do navegador.
            </p>
          </section>
        )}

        {removed && !installed && (
          <section className={s.section}>
            <p className={s.success}>
              {program.name} foi desinstalado. Ele já voltou para a lista como disponível, e dá
              para instalar de novo quando quiser.
            </p>
          </section>
        )}

        {installed && (
          <section className={s.section}>
            <div className={s.label}>REMOVER DO COMPUTADOR</div>
            <p className={s.description}>
              Desinstala o {program.name} desta máquina pelo mesmo caminho que o Windows usaria.
              Seus arquivos e configurações pessoais não são apagados por aqui.
            </p>

            {error && <p className={s.error}>{error}</p>}

            {confirming ? (
              <div className={s.confirm}>
                <span className={s.confirmText}>
                  Desinstalar o {program.name} agora? Ele sai da lista de instalados.
                </span>
                <button type="button" className={s.danger} onClick={remove} disabled={removing}>
                  {removing ? 'Desinstalando e conferindo…' : 'Sim, desinstalar'}
                </button>
                <button
                  type="button"
                  className={s.secondary}
                  onClick={() => setConfirming(false)}
                  disabled={removing}
                >
                  Deixar como está
                </button>
              </div>
            ) : (
              <button type="button" className={s.danger} onClick={() => setConfirming(true)}>
                Desinstalar do PC
              </button>
            )}
          </section>
        )}
      </div>

      <footer className={s.footer}>
        <div className={s.footerSummary}>
          {installed
            ? canApply
              ? 'este programa já existe: dá para aplicar só os ajustes'
              : 'já instalado — marque ajustes para poder aplicá-los'
            : installsItself
              ? 'os ajustes valem quando este programa for instalado'
              : 'as páginas abrem quando você mandar instalar'}
        </div>

        <div className={s.footerActions}>
          {canApply && (
            <button type="button" className={s.secondary} onClick={onApplyNow}>
              Aplicar ajustes agora
            </button>
          )}
          <button type="button" className={s.primary} onClick={onBack}>
            Voltar para a seleção
          </button>
        </div>
      </footer>
    </div>
  )
}
