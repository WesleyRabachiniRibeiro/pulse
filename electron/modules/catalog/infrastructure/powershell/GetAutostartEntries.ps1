$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$runKeys = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
  'HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Run'
)
$approval = Get-Item 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'
$approved = @()
if ($approval) { $approved = @($approval.GetValueNames()) }

$appModel = 'HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\SystemAppData'

@(
foreach ($key in $runKeys) {
  $item = Get-Item $key
  if (-not $item) { continue }
  foreach ($name in $item.GetValueNames()) {
    $enabled = $true
    if ($approved -contains $name) {
      $bytes = $approval.GetValue($name)
      if ($bytes -and (($bytes[0] % 2) -eq 1)) { $enabled = $false }
    }
    [pscustomobject]@{
      name    = [string]$name
      value   = [string]$item.GetValue($name)
      enabled = [bool]$enabled
    }
  }
}

foreach ($package in @(Get-ChildItem $appModel)) {
  foreach ($task in @(Get-ChildItem $package.PSPath)) {
    $state = $task.GetValue('State')
    if ($null -eq $state) { continue }
    [pscustomobject]@{
      name    = [string]$package.PSChildName
      value   = ''
      enabled = ([int]$state -eq 2 -or [int]$state -eq 4)
    }
  }
}
) | ConvertTo-Json -Compress
