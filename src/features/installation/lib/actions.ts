import type { Request } from '@shared/domain/installation'
import { bridge } from '@/shared/lib/bridge'
import { useRunStore } from '../store/useRun'
import { refusalText } from './refusal'

export async function startInstallation(
  requests: readonly Request[],
  drive: string,
): Promise<void> {
  const result = await bridge.invoke('installation:start', { requests: [...requests], drive })
  if (!result.ok) throw new Error(refusalText(result.refused))
  useRunStore.getState().set(result.run)
}

export async function appendToQueue(requests: readonly Request[]): Promise<void> {
  const result = await bridge.invoke('installation:append', { requests: [...requests] })
  if (!result.ok) throw new Error(refusalText(result.refused))
  if (result.run) useRunStore.getState().set(result.run)
}
