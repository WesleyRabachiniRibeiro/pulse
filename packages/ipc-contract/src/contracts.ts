import { z } from 'zod'
import {
  packageVersionSchema,
  driveSchema,
  preflightPartialSchema,
  preflightSchema,
  requestSchema,
  runSchema,
  steamGameSchema,
  steamLibrarySchema,
  preferencesSchema,
  gitSchema,
  updateStateSchema,
} from '@pulse/domain'

// O renderer nunca vê o segredo: a visão diz só se existe PIN cadastrado.
export const parentalViewSchema = z.object({
  on: z.boolean(),
  hasPin: z.boolean(),
  blocked: z.array(z.string()),
})
export type ParentalView = z.infer<typeof parentalViewSchema>

export const pinResultSchema = z.object({
  ok: z.boolean(),
  view: parentalViewSchema.optional(),
})
export type PinResult = z.infer<typeof pinResultSchema>

export const freshInputSchema = z.object({
  fresh: z.boolean().optional(),
})
export type FreshInput = z.infer<typeof freshInputSchema>

export const preflightInputSchema = z.object({
  drive: z.string().optional(),
})
export type PreflightInput = z.infer<typeof preflightInputSchema>

export const idInputSchema = z.object({ id: z.string() })
export type IdInput = z.infer<typeof idInputSchema>

export const requestsInputSchema = z.object({ requests: z.array(requestSchema).min(1) })
export type RequestsInput = z.infer<typeof requestsInputSchema>

export const startInputSchema = z.object({
  requests: z.array(requestSchema).min(1),
  drive: z.string(),
})
export type StartInput = z.infer<typeof startInputSchema>

export const steamSearchInputSchema = z.object({
  term: z.string().min(2),
})
export type SteamSearchInput = z.infer<typeof steamSearchInputSchema>

export const ipcContracts = {
  'preflight:drives': {
    input: freshInputSchema,
    output: z.array(driveSchema),
  },
  'preflight:run': {
    input: preflightInputSchema,
    output: preflightSchema,
  },
  'update:state': {
    input: z.void(),
    output: updateStateSchema,
  },
  'update:install': {
    input: z.void(),
    output: z.void(),
  },
  'catalog:installed': {
    input: freshInputSchema,
    output: z.array(z.string()),
  },
  'parental:read': {
    input: z.void(),
    output: parentalViewSchema,
  },
  'parental:turnOn': {
    input: z.object({ pin: z.string() }),
    output: pinResultSchema,
  },
  'parental:turnOff': {
    input: z.object({ pin: z.string() }),
    output: pinResultSchema,
  },
  'parental:change': {
    input: z.object({ current: z.string(), next: z.string() }),
    output: pinResultSchema,
  },
  'parental:check': {
    input: z.object({ pin: z.string() }),
    output: z.boolean(),
  },
  'parental:setBlocked': {
    input: z.object({ ids: z.array(z.string()) }),
    output: parentalViewSchema,
  },
  'prefs:read': {
    input: z.void(),
    output: preferencesSchema,
  },
  'prefs:write': {
    input: preferencesSchema,
    output: preferencesSchema,
  },
  'git:config': {
    input: z.void(),
    output: gitSchema,
  },
  'catalog:autostart': {
    input: z.void(),
    output: z.array(z.object({ id: z.string(), state: z.enum(['on', 'off']) })),
  },
  'catalog:versions': {
    input: idInputSchema,
    output: z.array(packageVersionSchema),
  },
  'installation:start': {
    input: startInputSchema,
    output: runSchema,
  },
  'installation:append': {
    input: requestsInputSchema,
    output: runSchema.nullable(),
  },
  'installation:state': {
    input: z.void(),
    output: runSchema.nullable(),
  },
  'installation:cancel': {
    input: z.void(),
    output: z.void(),
  },
  'installation:cancelItem': {
    input: idInputSchema,
    output: z.void(),
  },
  'installation:retry': {
    input: idInputSchema,
    output: z.void(),
  },
  'installation:grant': {
    input: idInputSchema,
    output: z.void(),
  },
  'installation:uninstall': {
    input: idInputSchema,
    output: z.object({
      ok: z.boolean(),
      verified: z.boolean(),
      error: z.string().optional(),
    }),
  },
  'steam:library': {
    input: z.void(),
    output: steamLibrarySchema,
  },
  'steam:search': {
    input: steamSearchInputSchema,
    output: z.array(steamGameSchema),
  },
  'system:restart': {
    input: z.void(),
    output: z.void(),
  },
  'system:cancelRestart': {
    input: z.void(),
    output: z.void(),
  },
  'window:minimize': {
    input: z.void(),
    output: z.void(),
  },
  'window:toggleMaximize': {
    input: z.void(),
    output: z.boolean(),
  },
  'window:close': {
    input: z.void(),
    output: z.void(),
  },
} as const

export type IpcContracts = typeof ipcContracts
export type IpcChannel = keyof IpcContracts

export type IpcInput<C extends IpcChannel> = z.infer<IpcContracts[C]['input']>
export type IpcOutput<C extends IpcChannel> = z.infer<IpcContracts[C]['output']>

export const ipcChannels = Object.keys(ipcContracts) as IpcChannel[]

export const ipcEvents = {
  'installation:event': runSchema,
  'preflight:event': preflightPartialSchema,
  'update:event': updateStateSchema,
} as const

export type IpcEvents = typeof ipcEvents
export type IpcEvent = keyof IpcEvents
export type IpcPayload<E extends IpcEvent> = z.infer<IpcEvents[E]>

export const ipcEventChannels = Object.keys(ipcEvents) as IpcEvent[]
