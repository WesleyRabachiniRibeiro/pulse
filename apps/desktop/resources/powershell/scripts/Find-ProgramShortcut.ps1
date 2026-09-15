param([string]$ParamsJson)

$ErrorActionPreference = 'SilentlyContinue'
$p = $ParamsJson | ConvertFrom-Json

# Uma varredura serve para vários programas: o menu Iniciar é lido uma vez e
# cada pedido é casado contra a mesma lista.
$wanted = @($p.wanted)

$menus = @(
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
  (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs')
)

$links = @()
foreach ($menu in $menus) {
  if (-not (Test-Path -LiteralPath $menu)) { continue }
  $links += @(Get-ChildItem -Path $menu -Filter '*.lnk' -File -Recurse)
}

$found = @()
foreach ($item in $wanted) {
  $id = [string]$item.id
  $hints = @($item.hints | ForEach-Object { ([string]$_).ToLower() })
  if ($hints.Count -eq 0) { continue }

  foreach ($link in $links) {
    $name = $link.BaseName.ToLower()
    $hit = $false
    foreach ($hint in $hints) {
      if ($name -like "*$hint*") { $hit = $true; break }
    }
    if (-not $hit) { continue }

    $found += [pscustomobject]@{ id = $id; path = $link.FullName }
    break
  }
}

[pscustomobject]@{ found = @($found) } | ConvertTo-Json -Compress -Depth 3
