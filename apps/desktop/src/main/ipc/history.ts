import { register } from './register'
import type { HistoryService } from '../application/history/HistoryService'

export function registerHistory(service: HistoryService): void {
  register('history:read', async () => [...(await service.read())])
  register('history:clear', async () => [...(await service.clear())])
}
