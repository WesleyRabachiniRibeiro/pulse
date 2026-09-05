import type {
  IpcChannel,
  IpcEvent,
  IpcInput,
  IpcOutput,
  IpcPayload,
} from '@shared/ipc/contracts'

interface Bridge {
  invoke<C extends IpcChannel>(channel: C, input: IpcInput<C>): Promise<IpcOutput<C>>
  on<E extends IpcEvent>(channel: E, listener: (payload: IpcPayload<E>) => void): () => void
}

declare global {
  interface Window {
    bridge: Bridge
  }
}

export const bridge: Bridge = window.bridge
