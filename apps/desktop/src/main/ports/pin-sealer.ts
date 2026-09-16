export interface PinSealer {
  seal(digits: string): string
  matches(secret: string, digits: string): boolean
}
