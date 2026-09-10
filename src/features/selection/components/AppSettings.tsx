import { useState } from 'react'
import { settingsAreEmpty, stepsFor, type Settings } from '@shared/domain/settings'
import { formatMb, type Program } from '@shared/domain/catalog'
import type { Defaults } from '@shared/domain/defaults'
import type { Drive } from '@shared/domain/preflight'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import {
  uninstallProgram,
  useUninstalled,
  useUninstalling,
  useUninstallError,
} from '../store/useUninstall'
import s from './AppSettings.module.css'
import { PackageVersions } from './PackageVersions'
import { ProgramExceptions } from './ProgramExceptions'
import { StepSection } from './steps'

interface Props {
  program: Program
  installed: boolean
  drives: readonly Drive[]
  generalDrive: string
  chosenDrive: string | null
  defaults: Defaults
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
  chosenDrive,
  defaults,
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

  const installsItself = program.source !== 'pages'
  const steps = stepsFor(program)
  const canApply = installed && !settingsAreEmpty(settings)

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
          <section className={s.section}>
            <div className={s.label}>ANTES DE INSTALAR</div>
            <p className={s.description}>{program.notice}</p>
          </section>
        )}

        {installsItself && (
          <ProgramExceptions
            settings={settings}
            defaults={defaults}
            drives={drives}
            generalDrive={generalDrive}
            chosenDrive={chosenDrive}
            onChangeSettings={(next) => onChangeSettings(program.id, next)}
            onChangeDrive={(letra) => onChangeDrive(program.id, letra)}
          />
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

        {steps.map((step) => (
          <StepSection
            key={step.id}
            step={step}
            programId={program.id}
            steps={settings.steps}
            onChangeSteps={(next) => onChangeSettings(program.id, { ...settings, steps: next })}
          />
        ))}


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
