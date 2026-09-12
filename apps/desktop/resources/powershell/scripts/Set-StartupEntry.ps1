param([string]$ParamsJson)

$ErrorActionPreference = 'SilentlyContinue'
$p = $ParamsJson | ConvertFrom-Json
$name = [string]$p.name
$turnOn = [bool]$p.turnOn

# O Windows não apaga a entrada para desligar: ele grava uma aprovação à parte,
# em StartupApproved, e o primeiro byte diz se está ligada. Mexer na chave Run
# em si apagaria o cadastro do programa, que não é o que a pessoa pediu.
$approval = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'
if (-not (Test-Path $approval)) { New-Item -Path $approval -Force | Out-Null }

$bytes = New-Object byte[] 12
$bytes[0] = if ($turnOn) { 2 } else { 3 }

try {
  New-ItemProperty -Path $approval -Name $name -Value $bytes -PropertyType Binary -Force | Out-Null
  [pscustomobject]@{ ok = $true } | ConvertTo-Json -Compress
} catch {
  [pscustomobject]@{ ok = $false } | ConvertTo-Json -Compress
}
