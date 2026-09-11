param([string]$ParamsJson)

$ErrorActionPreference = 'SilentlyContinue'
$p = $ParamsJson | ConvertFrom-Json
$hints = @($p.hints | ForEach-Object { ([string]$_).ToLower() })
$turnOn = [bool]$p.turnOn

function Emit([string]$result) {
  [pscustomobject]@{ result = $result } | ConvertTo-Json -Compress
  exit
}

$runKeys = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
  'HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Run'
)

$found = @()
foreach ($key in $runKeys) {
  $item = Get-Item $key
  if (-not $item) { continue }
  foreach ($name in $item.GetValueNames()) {
    $value = [string]$item.GetValue($name)
    $target = ($name + ' ' + $value).ToLower()
    foreach ($hint in $hints) {
      if ($target -like "*$hint*") { $found += $name; break }
    }
  }
}

$appModel = 'HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\SystemAppData'

$tasks = @()
foreach ($package in @(Get-ChildItem $appModel)) {
  $target = ([string]$package.PSChildName).ToLower()
  $matched = $false
  foreach ($hint in $hints) {
    if ($target -like "*$hint*") { $matched = $true; break }
  }
  if (-not $matched) { continue }
  foreach ($task in @(Get-ChildItem $package.PSPath)) {
    if ($null -ne $task.GetValue('State')) { $tasks += $task.PSPath }
  }
}

if ($found.Count -eq 0 -and $tasks.Count -eq 0) { Emit 'no-entry' }

# 2 no primeiro byte quer dizer "aprovado"; 3 quer dizer "desativado pela pessoa".
$approval = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'
if (-not (Test-Path $approval)) { New-Item -Path $approval -Force | Out-Null }

$bytes = New-Object byte[] 12
$bytes[0] = if ($turnOn) { 2 } else { 3 }

foreach ($name in ($found | Sort-Object -Unique)) {
  New-ItemProperty -Path $approval -Name $name -Value $bytes -PropertyType Binary -Force | Out-Null
}

# 2 é ativado e 1 é desligado pela pessoa, os mesmos valores que a aba
# Inicializar grava para apps que vieram da Store.
$state = if ($turnOn) { 2 } else { 1 }

foreach ($path in ($tasks | Sort-Object -Unique)) {
  Set-ItemProperty -Path $path -Name 'State' -Value $state -Type DWord -Force
}

Emit $(if ($turnOn) { 'on' } else { 'off' })
