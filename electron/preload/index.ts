import { contextBridge, ipcRenderer } from 'electron'
import {
  ipcChannels,
  ipcEventChannels,
  type IpcChannel,
  type IpcEvent,
  type IpcInput,
  type IpcOutput,
  type IpcPayload,
} from '@shared/ipc/contracts'

const bridge = {
  invoke<C extends IpcChannel>(channel: C, input: IpcInput<C>): Promise<IpcOutput<C>> {
    if (!ipcChannels.includes(channel)) {
      return Promise.reject(new Error(`[bridge] undeclared channel: "${String(channel)}"`))
    }
    return ipcRenderer.invoke(channel, input) as Promise<IpcOutput<C>>
  },

  on<E extends IpcEvent>(channel: E, listener: (payload: IpcPayload<E>) => void): () => void {
    if (!ipcEventChannels.includes(channel)) {
      throw new Error(`[bridge] undeclared event: "${String(channel)}"`)
    }
    const handle = (_event: unknown, payload: unknown) => listener(payload as IpcPayload<E>)
    ipcRenderer.on(channel, handle)
    return () => {
      ipcRenderer.off(channel, handle)
    }
  },
}

export type Bridge = typeof bridge

contextBridge.exposeInMainWorld('bridge', bridge)
