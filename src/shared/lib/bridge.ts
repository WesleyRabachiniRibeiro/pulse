import type {
  IpcChannel,
  IpcEvent,
  IpcInput,
  IpcOutput,
  IpcPayload,
} from '@shared/ipc/contracts'

type InvokeArgs<C extends IpcChannel> = IpcInput<C> extends void
  ? [input?: undefined]
  : [input: IpcInput<C>]

interface Bridge {
  invoke<C extends IpcChannel>(channel: C, ...args: InvokeArgs<C>): Promise<IpcOutput<C>>
  on<E extends IpcEvent>(channel: E, listener: (payload: IpcPayload<E>) => void): () => void
}

declare global {
  interface Window {
    bridge: Bridge
  }
}

export const bridge: Bridge = window.bridge
