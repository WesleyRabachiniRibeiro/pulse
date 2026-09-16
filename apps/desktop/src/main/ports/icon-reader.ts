export interface IconReader {
  read(path: string): Promise<string | null>
}
