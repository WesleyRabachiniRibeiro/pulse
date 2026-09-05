import type { Request } from '@shared/domain/installation'
import { bridge } from '@/shared/lib/bridge'
import { useRunStore } from '../store/useRun'

export async function startInstallation(
  requests: readonly Request[],
  drive: string,
): Promise<void> {
  const run = await bridge.invoke('installation:start', { requests: [...requests], drive })
  useRunStore.getState().set(run)
}

export async function appendToQueue(requests: readonly Request[]): Promise<void> {
  const run = await bridge.invoke('installation:append', { requests: [...requests] })
  if (run) useRunStore.getState().set(run)
}
