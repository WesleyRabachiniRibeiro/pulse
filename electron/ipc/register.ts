import { ipcMain } from 'electron'
import { ipcContracts, type IpcChannel, type IpcInput, type IpcOutput } from '@shared/ipc/contracts'

type Handler<C extends IpcChannel> = (input: IpcInput<C>) => Promise<IpcOutput<C>> | IpcOutput<C>

export function register<C extends IpcChannel>(channel: C, handler: Handler<C>): void {
  ipcMain.handle(channel, async (_event, raw: unknown) => {
    const contract = ipcContracts[channel]

    const input = contract.input.safeParse(raw)
    if (!input.success) {
      throw new Error(`[ipc] invalid payload on "${channel}": ${input.error.message}`)
    }

    const result = await handler(input.data as IpcInput<C>)

    const output = contract.output.safeParse(result)
    if (!output.success) {
      throw new Error(`[ipc] invalid response on "${channel}": ${output.error.message}`)
    }

    return output.data
  })
}
