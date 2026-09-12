// O PIN nunca é guardado como a pessoa digitou. Quem sabe embaralhar e conferir
// em tempo constante é a infra; a application só pergunta se confere.
export interface PinSealer {
  seal(digits: string): string
  matches(secret: string, digits: string): boolean
}
