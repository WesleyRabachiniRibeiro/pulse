import { catalogued, strangers } from '@shared/domain/inventory'
import {
  reloadInventory,
  useInventory,
  useInventoryBusy,
  useInventoryLoaded,
} from '@/features/catalog'
import s from './Manage.module.css'

export function Manage() {
  const inventory = useInventory()
  const loaded = useInventoryLoaded()
  const busy = useInventoryBusy()

  const conhecidos = catalogued(inventory)
  const estranhos = strangers(inventory)

  return (
    <div className={s.screen}>
      <div className={s.eyebrow}>SEMPRE DISPONÍVEL</div>
      <h2 className={s.title}>Gerenciamento</h2>
      <p className={s.subtitle}>
        O que já está neste PC, o que tem versão nova esperando, e o que abre junto com o Windows.
        Este é o lugar para onde se volta depois que a instalação terminou.
      </p>

      <div className={s.sections}>
        <section className={s.section}>
          <div className={s.header}>
            <span className={s.name}>O QUE O PULSE ENXERGA HOJE</span>
            <span className={s.line} aria-hidden />
            <span className={s.scope}>
              {busy ? 'LENDO O PC…' : loaded ? 'LIDO AGORA' : 'AINDA NÃO LIDO'}
            </span>
          </div>

          <div className={s.rows}>
            <div className={s.row}>
              <span className={s.rowName}>Programas instalados</span>
              <span className={s.rowValue}>{inventory.apps.length}</span>
            </div>
            <div className={s.row}>
              <span className={s.rowName}>Reconhecidos pelo catálogo</span>
              <span className={s.rowValue}>{conhecidos.length}</span>
            </div>
            <div className={s.row}>
              <span className={s.rowName}>Fora do catálogo</span>
              <span className={s.rowValue}>{estranhos.length}</span>
            </div>
            <div className={s.row}>
              <span className={s.rowName}>Com versão nova esperando</span>
              <span className={s.rowValue}>{inventory.upgrades.length}</span>
            </div>
          </div>

          <button
            type="button"
            className={s.tab}
            disabled={busy}
            onClick={() => void reloadInventory(true)}
          >
            {busy ? 'LENDO…' : 'LER O PC DE NOVO'}
          </button>
        </section>

        <p className={s.pending}>
          As três abas, Instalados, Atualizações e Inicialização, entram no próximo passo. A leitura
          do PC já funciona e é o que alimenta os números acima, então o que falta aqui é a tela,
          não o dado.
        </p>
      </div>
    </div>
  )
}
