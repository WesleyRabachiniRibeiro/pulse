const DIACRITICS = /[̀-ͯ]/g

export function foldText(text: string): string {
  return text.normalize('NFD').replace(DIACRITICS, '').toLowerCase()
}
