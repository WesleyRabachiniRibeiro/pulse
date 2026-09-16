param([string]$ParamsJson)

$ErrorActionPreference = 'SilentlyContinue'
$p = $ParamsJson | ConvertFrom-Json
$hints = @($p.hints | ForEach-Object { ([string]$_).ToLower() })
$turnOn = [bool]$p.turnOn

function Emit([string]$result) {
  [pscustomobject]@{ result = $result } | ConvertTo-Json -Compress
  exit
}

if ($hints.Count -eq 0) { Emit 'not-found' }

$desktop = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktop)) { Emit 'not-found' }

function Matches([string]$name) {
  $low = $name.ToLower()
  foreach ($hint in $hints) {
    if ($low -like "*$hint*") { return $true }
  }
  return $false
}

# O atalho é copiado do menu Iniciar, que é onde o instalador cadastra. Quem
# não aparece lá não tem o que copiar, e isso não é falha.
$menus = @(
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
  (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs')
)

$onDesktop = @(Get-ChildItem -Path $desktop -Filter '*.lnk' -File | Where-Object { Matches $_.BaseName })

if (-not $turnOn) {
  if ($onDesktop.Count -eq 0) { Emit 'not-found' }
  foreach ($link in $onDesktop) { Remove-Item -LiteralPath $link.FullName -Force }
  Emit 'removed'
}

if ($onDesktop.Count -gt 0) { Emit 'already' }

foreach ($menu in $menus) {
  if (-not (Test-Path -LiteralPath $menu)) { continue }

  $found = @(Get-ChildItem -Path $menu -Filter '*.lnk' -File -Recurse | Where-Object { Matches $_.BaseName })
  if ($found.Count -eq 0) { continue }

  $source = $found[0]
  Copy-Item -LiteralPath $source.FullName -Destination (Join-Path $desktop $source.Name) -Force
  if (Test-Path -LiteralPath (Join-Path $desktop $source.Name)) { Emit 'created' }
}

Emit 'not-found'
