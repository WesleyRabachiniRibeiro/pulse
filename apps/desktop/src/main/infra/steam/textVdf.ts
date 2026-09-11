// O Steam guarda alguns arquivos em texto VDF (diferente do binário de vdf.ts)
// sem parser oficial disponível para Node — regex/varredura de chaves é a
// única saída, então essa técnica fica isolada aqui, testável sem IO real.

export function parseLibraryFolderPaths(vdfText: string): string[] {
  const paths: string[] = []
  for (const found of vdfText.matchAll(/"path"\s+"([^"]+)"/g)) {
    const path = found[1]?.replace(/\\\\/g, '\\')
    if (path) paths.push(path)
  }
  return paths
}

export function parseAcfField(text: string, key: string): string | undefined {
  return new RegExp(`"${key}"\\s+"([^"]*)"`, 'i').exec(text)?.[1]
}

export function parseAppsSection(localConfigText: string): Set<string> {
  const lower = localConfigText.toLowerCase()
  let best = new Set<string>()

  for (let at = lower.indexOf('"apps"'); at >= 0; at = lower.indexOf('"apps"', at + 1)) {
    const found = new Set<string>()
    let depth = 0
    let opened = false

    for (let p = at; p < localConfigText.length; p++) {
      const c = localConfigText[p]
      if (c === '{') {
        depth++
        opened = true
      } else if (c === '}') {
        depth--
        if (opened && depth === 0) break
      } else if (c === '"' && depth === 1) {
        const end = localConfigText.indexOf('"', p + 1)
        if (end < 0) break
        const key = localConfigText.slice(p + 1, end)
        if (/^\d+$/.test(key)) found.add(key)
        p = end
      }
    }

    if (found.size > best.size) best = found
  }

  return best
}
