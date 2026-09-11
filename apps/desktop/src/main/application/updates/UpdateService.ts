import type { UpdateState } from '@pulse/domain'
import type { UpdateChecker } from '../../ports/update-checker'

// O acoplamento com a fila de instalação (não instalar uma atualização
// sozinha enquanto ela roda) entra só como um predicado — este serviço não
// conhece QueueOrchestrator, só chama isQueueBusy() sempre que precisa saber.
export class UpdateService {
  constructor(
    private readonly checker: UpdateChecker,
    private readonly isQueueBusy: () => boolean,
  ) {}

  subscribe(listener: (state: UpdateState) => void): () => void {
    return this.checker.subscribe(listener)
  }

  currentState(): UpdateState {
    return this.checker.currentState()
  }

  start(): void {
    this.checker.start()
    this.checker.setBusy(this.isQueueBusy())
  }

  installNow(): void {
    if (this.currentState().status !== 'ready') return
    if (this.isQueueBusy()) {
      this.checker.setBusy(true)
      return
    }
    this.checker.installNow()
  }

  onQueueChanged(): void {
    if (this.currentState().status === 'ready') this.checker.setBusy(this.isQueueBusy())
  }
}
