import { contextBridge, ipcRenderer } from 'electron'
import {
  ipcChannels,
  ipcContracts,
  ipcEventChannels,
  ipcEvents,
  type IpcChannel,
  type IpcEvent,
  type IpcInput,
  type IpcOutput,
  type IpcPayload,
} from '@shared/ipc/contracts'

const bridge = {
  async invoke<C extends IpcChannel>(channel: C, input?: IpcInput<C>): Promise<IpcOutput<C>> {
    if (!ipcChannels.includes(channel)) {
      throw new Error(`[bridge] undeclared channel: "${String(channel)}"`)
    }

    const answer: unknown = await ipcRenderer.invoke(channel, input)
    const output = ipcContracts[channel].output.safeParse(answer)

    if (!output.success) {
      throw new Error(`[bridge] invalid response on "${channel}": ${output.error.message}`)
    }

    return output.data as IpcOutput<C>
  },

  on<E extends IpcEvent>(channel: E, listener: (payload: IpcPayload<E>) => void): () => void {
    if (!ipcEventChannels.includes(channel)) {
      throw new Error(`[bridge] undeclared event: "${String(channel)}"`)
    }

    const handle = (_event: unknown, raw: unknown) => {
      const payload = ipcEvents[channel].safeParse(raw)
      if (!payload.success) return
      listener(payload.data as IpcPayload<E>)
    }

    ipcRenderer.on(channel, handle)
    return () => {
      ipcRenderer.off(channel, handle)
    }
  },
}

export type Bridge = typeof bridge

contextBridge.exposeInMainWorld('bridge', bridge)
