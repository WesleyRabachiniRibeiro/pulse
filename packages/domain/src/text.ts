export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

export function equalsIgnoreCase(a: string, b: string): boolean {
  return a.toUpperCase() === b.toUpperCase()
}
