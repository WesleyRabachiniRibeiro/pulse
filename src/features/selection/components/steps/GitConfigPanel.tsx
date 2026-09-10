import { useEffect, useState } from 'react'
import { DEFAULT_GIT, LINE_ENDINGS, type GitConfig } from '@shared/domain/git'
import { bridge } from '@/shared/lib/bridge'
import s from '../AppSettings.module.css'
import type { PanelProps } from './panel'

export function GitConfigPanel({ value, onChange }: PanelProps<GitConfig>) {
  const [fromMachine, setFromMachine] = useState<GitConfig | null>(null)

  useEffect(() => {
    let alive = true
    void bridge
      .invoke('git:config')
      .then((config) => {
        if (alive) setFromMachine(config)
      })
      .catch(() => {
        if (alive) setFromMachine(DEFAULT_GIT)
      })
    return () => {
      alive = false
    }
  }, [])

  const git: GitConfig = value ?? fromMachine ?? DEFAULT_GIT

  function change(field: keyof GitConfig, next: unknown) {
    onChange({ ...git, [field]: next })
  }

  return (
    <>
      <div className={s.fields}>
        <label className={s.fieldBlock}>
          <span className={s.fieldLabel}>SEU NOME</span>
          <input
            className={s.input}
            value={git.name}
            onChange={(e) => change('name', e.target.value)}
            placeholder="Maria Silva"
          />
          <span className={s.fieldHint}>aparece como autor de cada commit</span>
        </label>

        <label className={s.fieldBlock}>
          <span className={s.fieldLabel}>SEU EMAIL</span>
          <input
            className={s.input}
            value={git.email}
            onChange={(e) => change('email', e.target.value)}
            placeholder="maria@exemplo.com"
          />
          <span className={s.fieldHint}>use o mesmo do GitHub para os commits contarem</span>
        </label>

        <label className={s.fieldBlock}>
          <span className={s.fieldLabel}>BRANCH INICIAL</span>
          <input
            className={s.input}
            value={git.branch}
            onChange={(e) => change('branch', e.target.value)}
            placeholder="main"
          />
          <span className={s.fieldHint}>o nome do primeiro branch de todo repositório novo</span>
        </label>
      </div>

      <div className={s.label}>FIM DE LINHA</div>
      <p className={s.description}>
        Windows e Linux marcam o fim da linha de jeitos diferentes, e é isso que faz um arquivo
        aparecer inteiro modificado num diff sem ninguém ter tocado nele.
      </p>

      <div className={s.drives}>
        {LINE_ENDINGS.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className={s.drive}
            aria-pressed={git.lineEnding === choice.id}
            onClick={() =>
              change('lineEnding', git.lineEnding === choice.id ? undefined : choice.id)
            }
          >
            <span className={s.driveName}>{choice.name}</span>
            <span className={s.driveNote}>{choice.hint}</span>
          </button>
        ))}
      </div>

      <div className={s.options}>
        <button
          type="button"
          role="checkbox"
          aria-checked={git.pullRebase === true}
          className={s.option}
          onClick={() => change('pullRebase', git.pullRebase ? undefined : true)}
        >
          <span className={s.box} aria-hidden>
            {git.pullRebase ? '✓' : ''}
          </span>
          <span className={s.optionBody}>
            <span className={s.optionName}>Puxar com rebase, não com merge</span>
            <span className={s.optionHint}>
              o histórico fica em linha reta, sem aquele commit de merge a cada git pull
            </span>
          </span>
          <span className={s.optionCategory}>HISTÓRICO</span>
        </button>

        <button
          type="button"
          role="checkbox"
          aria-checked={git.sshKey === true}
          className={s.option}
          onClick={() => change('sshKey', git.sshKey ? undefined : true)}
        >
          <span className={s.box} aria-hidden>
            {git.sshKey ? '✓' : ''}
          </span>
          <span className={s.optionBody}>
            <span className={s.optionName}>Criar uma chave SSH, se você ainda não tiver</span>
            <span className={s.optionHint}>
              uma chave ed25519 sem senha, do jeito que o GitHub pede. A parte pública vai para a
              área de transferência, pronta para colar lá. Se você já tiver uma chave, o Pulse não
              encosta nela.
            </span>
          </span>
          <span className={s.optionCategory}>SSH</span>
        </button>

        <button
          type="button"
          role="checkbox"
          aria-checked={git.saveLogin === true}
          className={s.option}
          onClick={() => change('saveLogin', !git.saveLogin)}
        >
          <span className={s.box} aria-hidden>
            {git.saveLogin ? '✓' : ''}
          </span>
          <span className={s.optionBody}>
            <span className={s.optionName}>Guardar o login do GitHub</span>
            <span className={s.optionHint}>
              no primeiro push o GitHub abre no navegador, você entra por lá e o Windows lembra dali
              em diante
            </span>
          </span>
          <span className={s.optionCategory}>CONTA</span>
        </button>
      </div>

      <p className={s.description}>
        O Pulse não pede nem guarda a sua senha. Ele só liga o gerenciador de credenciais que já vem
        com o Git para Windows, e quem cuida do login é o próprio GitHub, na janela do navegador.
      </p>
    </>
  )
}
