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
  tweakInputSchema,
  tweakStateSchema,
  profileSchema,
  EXPORT_FORMATS,
  IMPORT_MODES,
  historySchema,
  upgradeSchema,
  startupEntrySchema,
  startupInputSchema,
  installedTreeSchema,
  catalogPayloadSchema,
  catalogStateSchema,
  programSchema,
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

export const exportResultSchema = z.object({
  status: z.enum(['saved', 'canceled', 'failed']),
  path: z.string().optional(),
})
export type ExportResult = z.infer<typeof exportResultSchema>

export const importResultSchema = z.object({
  status: z.enum(['imported', 'canceled', 'failed', 'invalid']),
  profile: profileSchema.optional(),
  count: z.number().optional(),
  missing: z.array(z.string()).optional(),
})
export type ImportResult = z.infer<typeof importResultSchema>

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
  'system:tweaks': {
    input: z.void(),
    output: z.array(tweakStateSchema),
  },
  'system:setTweak': {
    input: tweakInputSchema,
    output: z.array(tweakStateSchema),
  },
  'profile:export': {
    input: z.object({
      format: z.enum(EXPORT_FORMATS),
      profile: profileSchema,
      drive: z.string().optional(),
    }),
    output: exportResultSchema,
  },
  'profile:import': {
    input: z.object({ mode: z.enum(IMPORT_MODES), current: profileSchema }),
    output: importResultSchema,
  },
  'profile:importLink': {
    input: z.object({
      url: z.string(),
      mode: z.enum(IMPORT_MODES),
      current: profileSchema,
    }),
    output: importResultSchema,
  },
  'catalog:state': {
    input: z.void(),
    output: catalogStateSchema,
  },
  'catalog:payload': {
    input: z.void(),
    output: catalogPayloadSchema,
  },
  'catalog:mine': {
    input: z.void(),
    output: z.array(programSchema),
  },
  'catalog:add': {
    input: programSchema,
    output: z.object({ ok: z.boolean() }),
  },
  'catalog:remove': {
    input: z.object({ id: z.string() }),
    output: z.array(programSchema),
  },
  'catalog:retry': {
    input: z.void(),
    output: catalogStateSchema,
  },
  'catalog:tree': {
    input: z.void(),
    output: installedTreeSchema,
  },
  'catalog:startup': {
    input: z.void(),
    output: z.array(startupEntrySchema),
  },
  'catalog:setStartup': {
    input: startupInputSchema,
    output: z.array(startupEntrySchema),
  },
  'catalog:upgrades': {
    input: z.void(),
    output: z.array(upgradeSchema),
  },
  'history:read': {
    input: z.void(),
    output: historySchema,
  },
  'history:clear': {
    input: z.void(),
    output: historySchema,
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
  'installation:openable': {
    input: z.object({ ids: z.array(z.string()) }),
    output: z.array(z.string()),
  },
  'installation:open': {
    input: z.object({ id: z.string() }),
    output: z.boolean(),
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
  'system:icon': {
    input: z.object({ path: z.string() }),
    output: z.string().nullable(),
  },
  'system:openFamily': {
    input: z.void(),
    output: z.void(),
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
  'catalog:event': catalogStateSchema,
  'installation:event': runSchema,
  'preflight:event': preflightPartialSchema,
  'update:event': updateStateSchema,
} as const

export type IpcEvents = typeof ipcEvents
export type IpcEvent = keyof IpcEvents
export type IpcPayload<E extends IpcEvent> = z.infer<IpcEvents[E]>

export const ipcEventChannels = Object.keys(ipcEvents) as IpcEvent[]
