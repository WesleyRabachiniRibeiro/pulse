export type CategoryId =
  | 'browsers'
  | 'games'
  | 'media'
  | 'office'
  | 'utilities'
  | 'creative'
  | 'security'
  | 'dev'
  | 'runtimes'
  | 'mine'

export interface Category {
  id: CategoryId
  name: string
}

export type SettingsKind = 'vscode' | 'steam' | 'git' | 'tibia' | 'riot' | 'vs' | 'browser'

export interface Program {
  id: string
  name: string
  winget?: string
  source?: 'msstore' | 'pages'
  version: string
  mb: number
  category: CategoryId
  hints: readonly string[]
  notice?: string
  settingsKind?: SettingsKind

  steps?: readonly string[]

  icon?: string
  family?: {
    prefix: string
    pattern: string
  }
}

export interface Bundle {
  name: string
  ids: readonly string[]
}

export interface SettingsOption {
  id: string
  name: string
  hint: string
  category: string
  url?: string
}
