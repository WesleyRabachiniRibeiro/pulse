export interface RemoteFetch {
  text(url: string): Promise<string | null>
}
