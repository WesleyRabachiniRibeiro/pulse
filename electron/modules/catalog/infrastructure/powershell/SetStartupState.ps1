$ErrorActionPreference = 'SilentlyContinue'

$approval = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'
if (-not (Test-Path $approval)) { New-Item -Path $approval -Force | Out-Null }

$runKeys = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
  'HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Run'
)

$isRun = $false
foreach ($key in $runKeys) {
  $item = Get-Item $key
  if (-not $item) { continue }
  if ($item.GetValueNames() -contains $Name) { $isRun = $true }
}

if ($isRun) {
  $bytes = New-Object byte[] 12
  $bytes[0] = if ($TurnOn) { 2 } else { 3 }
  New-ItemProperty -Path $approval -Name $Name -Value $bytes -PropertyType Binary -Force | Out-Null
  Write-Output 'ok'
  exit
}

$appModel = 'HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\SystemAppData'
$state = if ($TurnOn) { 2 } else { 1 }
$touched = $false

foreach ($package in @(Get-ChildItem $appModel)) {
  if ([string]$package.PSChildName -ne $Name) { continue }
  foreach ($task in @(Get-ChildItem $package.PSPath)) {
    if ($null -eq $task.GetValue('State')) { continue }
    Set-ItemProperty -Path $task.PSPath -Name 'State' -Value $state -Type DWord -Force
    $touched = $true
  }
}

if ($touched) { Write-Output 'ok' } else { Write-Output 'no-entry' }
