import { z } from 'zod'
import { preflightContracts } from '../features/preflight/contracts'
import { preflightPartialSchema } from '../domain/preflight'
import { updateContracts, updateEvents } from '../features/update/contracts'
import { catalogContracts, catalogEvents } from '../features/catalog/contracts'
import { parentalContracts } from '../features/parental/contracts'
import { preferencesContracts } from '../features/preferences/contracts'
import { profileContracts } from '../features/profile/contracts'
import { gitContracts } from '../features/git/contracts'
import { installationContracts, installationEvents } from '../features/installation/contracts'
import { steamContracts } from '../features/steam/contracts'
import { windowsContracts } from '../features/windows/contracts'
import { systemContracts } from '../features/system/contracts'
import { windowContracts } from '../features/window/contracts'

export { copyInputSchema, freshInputSchema, type CopyInput, type FreshInput } from '../features/shared'
export { parentalViewSchema, pinResultSchema } from '../features/parental/contracts'
export { importResultSchema } from '../features/profile/contracts'

export const ipcContracts = {
  ...preflightContracts,
  ...updateContracts,
  ...catalogContracts,
  ...parentalContracts,
  ...preferencesContracts,
  ...profileContracts,
  ...gitContracts,
  ...installationContracts,
  ...steamContracts,
  ...windowsContracts,
  ...systemContracts,
  ...windowContracts,
} as const

export type IpcContracts = typeof ipcContracts
export type IpcChannel = keyof IpcContracts

export type IpcInput<C extends IpcChannel> = z.infer<IpcContracts[C]['input']>
export type IpcOutput<C extends IpcChannel> = z.infer<IpcContracts[C]['output']>

export const ipcChannels = Object.keys(ipcContracts) as IpcChannel[]

export const ipcEvents = {
  ...installationEvents,
  'preflight:event': preflightPartialSchema,
  ...updateEvents,
  ...catalogEvents,
} as const

export type IpcEvents = typeof ipcEvents
export type IpcEvent = keyof IpcEvents
export type IpcPayload<E extends IpcEvent> = z.infer<IpcEvents[E]>

export const ipcEventChannels = Object.keys(ipcEvents) as IpcEvent[]
