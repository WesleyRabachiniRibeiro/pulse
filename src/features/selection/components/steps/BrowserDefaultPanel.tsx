import type { BrowserChoice } from '@shared/domain/steps'
import s from '../AppSettings.module.css'
import type { PanelProps } from './panel'

export function BrowserDefaultPanel({ value, onChange }: PanelProps<BrowserChoice>) {
  const choice = value ?? {}

  function flip(field: keyof BrowserChoice) {
    onChange({ ...choice, [field]: choice[field] ? undefined : true })
  }

  return (
    <>
      <div className={s.options}>
        <button
          type="button"
          role="checkbox"
          aria-checked={choice.makeDefault === true}
          className={s.option}
          onClick={() => flip('makeDefault')}
        >
          <span className={s.box} aria-hidden>
            {choice.makeDefault ? '✓' : ''}
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
          aria-checked={choice.openAfter === true}
          className={s.option}
          onClick={() => flip('openAfter')}
        >
          <span className={s.box} aria-hidden>
            {choice.openAfter ? '✓' : ''}
          </span>
          <span className={s.optionBody}>
            <span className={s.optionName}>Abrir no fim para importar meus dados</span>
            <span className={s.optionHint}>
              o Firefox abre direto no assistente; Chrome, Opera e Brave não deixam abrir essa tela
              por fora, então o Pulse mostra o endereço e copia para você colar
            </span>
          </span>
          <span className={s.optionCategory}>DADOS</span>
        </button>
      </div>

      <p className={s.description}>
        Quem importa é o navegador, não o Pulse. Senha fica cifrada com uma chave que só quem gravou
        possui, então ninguém de fora consegue trazer isso corretamente. O assistente do Firefox traz
        favoritos, senhas, histórico, extensões e preenchimento automático. Nada dos seus perfis é
        tocado por aqui.
      </p>
    </>
  )
}
