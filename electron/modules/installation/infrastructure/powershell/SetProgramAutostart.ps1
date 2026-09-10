$ErrorActionPreference = 'SilentlyContinue'

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
    foreach ($hint in $Hints) {
      if ($target -like "*$hint*") { $found += $name; break }
    }
  }
}

$appModel = 'HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\SystemAppData'

$tasks = @()
foreach ($package in @(Get-ChildItem $appModel)) {
  $target = ([string]$package.PSChildName).ToLower()
  $matched = $false
  foreach ($hint in $Hints) {
    if ($target -like "*$hint*") { $matched = $true; break }
  }
  if (-not $matched) { continue }
  foreach ($task in @(Get-ChildItem $package.PSPath)) {
    if ($null -ne $task.GetValue('State')) { $tasks += $task.PSPath }
  }
}

if ($found.Count -eq 0 -and $tasks.Count -eq 0) { Write-Output 'no-entry'; exit }

# 2 in the first byte means "approved"; 3 means "disabled by the user".
$approval = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'
if (-not (Test-Path $approval)) { New-Item -Path $approval -Force | Out-Null }

$bytes = New-Object byte[] 12
$bytes[0] = if ($TurnOn) { 2 } else { 3 }

foreach ($name in ($found | Sort-Object -Unique)) {
  New-ItemProperty -Path $approval -Name $name -Value $bytes -PropertyType Binary -Force | Out-Null
}

# 2 is enabled and 1 is turned off by the person, the same values the
# Startup tab writes for apps that came from the Store.
$state = if ($TurnOn) { 2 } else { 1 }

foreach ($path in ($tasks | Sort-Object -Unique)) {
  Set-ItemProperty -Path $path -Name 'State' -Value $state -Type DWord -Force
}

if ($TurnOn) { Write-Output 'on' } else { Write-Output 'off' }
