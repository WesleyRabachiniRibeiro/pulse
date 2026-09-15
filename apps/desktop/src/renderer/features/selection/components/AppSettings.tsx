import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_GIT,
  formatMb,
  listValue,
  stepForKind,
  stepsFor,
  settingsAreEmpty,
  withListValue,
  type AnyStep,
  type Defaults,
  type GitConfig,
  type Settings,
} from '@pulse/domain'
import type { Program } from '@pulse/domain'
import type { Drive } from '@pulse/domain'
import type { SteamGame } from '@pulse/domain'
import { bridge } from '@/shared/lib/bridge'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import {
  uninstallProgram,
  useUninstalled,
  useUninstalling,
  useUninstallError,
} from '../store/useUninstall'
import { ProgramExceptions } from './ProgramExceptions'
import s from './AppSettings.module.css'
import { CheckOption } from './CheckOption'
import { StepSection } from './StepSection'
import { StepOptionList } from './StepOptionList'
import { SteamGames } from './SteamGames'
import { PackageVersions } from './PackageVersions'

interface Props {
  program: Program
  installed: boolean
  drives: readonly Drive[]
  generalDrive: string
  defaults: Defaults
  chosenDrive: string | null
  currentAutostart: 'on' | 'off' | null
  settings: Settings
  onChangeDrive: (id: string, drive: string | null) => void
  onChangeSettings: (id: string, settings: Settings) => void
  onApplyNow: () => void
  onBack: () => void
}


export function AppSettings({
  program,
  installed,
  drives,
  generalDrive,
  defaults,
  chosenDrive,
  currentAutostart,
  settings,
  onChangeDrive,
  onChangeSettings,
  onApplyNow,
  onBack,
}: Props) {
  const [confirming, setConfirming] = useState(false)
  const removing = useUninstalling(program.id)
  const removed = useUninstalled(program.id)
  const error = useUninstallError(program.id)
  const [machineGit, setGitDaMaquina] = useState<GitConfig | null>(null)

  const kind = program.settingsKind

  useEffect(() => {
    if (kind !== 'git') return
    let alive = true
    void bridge
      .invoke('git:config', undefined)
      .then((c) => {
        if (alive) setGitDaMaquina(c)
      })
      .catch(() => {
        if (alive) setGitDaMaquina(DEFAULT_GIT)
      })
    return () => {
      alive = false
    }
  }, [kind])
  const installsItself = program.source !== 'pages'
  const programSteps = useMemo(() => stepsFor(program), [program])
  const listSteps = programSteps.filter((x) => x.options ?? x.optionsFor)
  const step = stepForKind(kind)
  const has = (id: string) => programSteps.some((x) => x.id === id)

  const steps = settings.steps ?? {}
  const browser = steps.browserDefault ?? {}

  function patchSteps(patch: Partial<NonNullable<Settings['steps']>>) {
    onChangeSettings(program.id, { ...settings, steps: { ...steps, ...patch } })
  }

  const git: GitConfig = steps.gitConfig ?? machineGit ?? DEFAULT_GIT
  const canApply = installed && !settingsAreEmpty(settings)

  function toggleOption(listStep: AnyStep, id: string) {
    const chosen = listValue(steps, listStep)
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]
    onChangeSettings(program.id, { ...settings, steps: withListValue(steps, listStep, next) })
  }

  function toggleGame(game: SteamGame) {
    const current = steps.steamGames ?? []
    const next = current.some((g) => g.appid === game.appid)
      ? current.filter((g) => g.appid !== game.appid)
      : [...current, game]
    patchSteps({ steamGames: next })
  }

  function changeGit(field: keyof GitConfig, value: string) {
    patchSteps({ gitConfig: { ...git, [field]: value } })
  }

  function remove() {
    setConfirming(false)
    void uninstallProgram(program.id)
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
          <StepSection title="ANTES DE INSTALAR" description={program.notice} />
        )}

        {installsItself && (
          <ProgramExceptions
            settings={settings}
            defaults={defaults}
            drives={drives}
            generalDrive={generalDrive}
            chosenDrive={chosenDrive}
            currentAutostart={currentAutostart}
            installed={installed}
            onChangeSettings={(next) => onChangeSettings(program.id, next)}
            onChangeDrive={(letter) => onChangeDrive(program.id, letter)}
          />
        )}

        {program.family && (
          <StepSection
            title="QUAL VERSÃO INSTALAR"
            description={`O ${program.name} existe em várias versões que convivem na mesma máquina. A lista vem do próprio winget, então está sempre atual.`}
          >

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
          </StepSection>
        )}


        {has('steamGames') && (
          <StepSection title={step?.title} description={step?.description} tour="aj-kind">
            <SteamGames chosen={steps.steamGames ?? []} onToggle={toggleGame} />
          </StepSection>
        )}

        {listSteps.map((listStep) => (
          <StepOptionList
            key={listStep.id}
            step={listStep}
            programId={program.id}
            chosen={listValue(steps, listStep)}
            onToggle={toggleOption}
          />
        ))}

        {has('browserDefault') && (
          <StepSection title={step?.title} description={step?.description} tour="aj-kind">

            <div className={s.options}>
              <CheckOption
                checked={browser.makeDefault === true}
                name="Deixar como navegador padrão"
                hint="se você marcar mais de um, vale o último que terminar de instalar"
                category="PADRÃO"
                onToggle={() =>
                  patchSteps({ browserDefault: { ...browser, makeDefault: !browser.makeDefault } })
                }
              />

              <CheckOption
                checked={browser.openAfter === true}
                name="Abrir no fim para importar meus dados"
                hint="o Firefox abre direto no assistente; Chrome, Opera e Brave não deixam abrir essa tela por fora, então o Pulse mostra o endereço e copia para você colar"
                category="DADOS"
                onToggle={() =>
                  patchSteps({ browserDefault: { ...browser, openAfter: !browser.openAfter } })
                }
              />
            </div>

            <p className={s.description}>
              Quem importa é o navegador, não o Pulse. Senha fica cifrada com uma chave que
              só quem gravou possui, então ninguém de fora consegue trazer isso corretamente. O
              assistente do Firefox traz favoritos, senhas, histórico, extensões e preenchimento
              automático. Nada dos seus perfis é tocado por aqui.
            </p>
          </StepSection>
        )}

        {has('gitConfig') && (
          <StepSection title={step?.title} description={step?.description} tour="aj-kind">

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
              <CheckOption
                checked={git.saveLogin === true}
                name="Guardar o login do GitHub"
                hint="no primeiro push o GitHub abre no navegador, você entra por lá e o Windows lembra dali em diante"
                category="CONTA"
                onToggle={() => patchSteps({ gitConfig: { ...git, saveLogin: !git.saveLogin } })}
              />
            </div>

            <p className={s.description}>
              O Pulse não pede nem guarda a sua senha. Ele só liga o gerenciador de
              credenciais que já vem com o Git para Windows, e quem cuida do login é o próprio
              GitHub, na janela do navegador.
            </p>
          </StepSection>
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

            {removing ? (
              <div className={s.confirm}>
                <span className={s.confirmText}>
                  A desinstalação está em andamento e continua mesmo se você sair desta tela.
                </span>
                <button type="button" className={s.danger} disabled>
                  Desinstalando e conferindo…
                </button>
              </div>
            ) : confirming ? (
              <div className={s.confirm}>
                <span className={s.confirmText}>
                  Desinstalar o {program.name} agora? Ele sai da lista de instalados.
                </span>
                <button type="button" className={s.danger} onClick={remove}>
                  Sim, desinstalar
                </button>
                <button
                  type="button"
                  className={s.secondary}
                  onClick={() => setConfirming(false)}
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
