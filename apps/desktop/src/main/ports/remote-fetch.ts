export interface RemoteFetch {
  // Devolve null em vez de lançar: link errado, fora do ar e resposta gigante
  // são todos "não deu", e quem chama trata igual.
  text(url: string): Promise<string | null>
}
