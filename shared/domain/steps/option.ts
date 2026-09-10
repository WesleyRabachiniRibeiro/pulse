export interface SettingsOption {
  id: string
  name: string
  hint: string
  category: string
  url?: string
}

export function byId<T extends SettingsOption>(
  options: readonly T[],
): ReadonlyMap<string, T> {
  return new Map(options.map((option) => [option.id, option]))
}

export function categoriesOf(options: readonly SettingsOption[]): string[] {
  const seen: string[] = []
  for (const option of options) if (!seen.includes(option.category)) seen.push(option.category)
  return ['Tudo', ...seen]
}

export function countLabel(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}
