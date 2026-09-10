$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$keys = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
@(Get-ItemProperty $keys | Where-Object { $_.DisplayName } | ForEach-Object {
  [pscustomobject]@{
    key       = [string]$_.PSChildName
    name      = [string]$_.DisplayName
    publisher = [string]$_.Publisher
    version   = [string]$_.DisplayVersion
    system    = [bool]$_.SystemComponent
    location  = [string]$_.InstallLocation
    icon      = [string]$_.DisplayIcon
    uninstall = [string]$(if ($_.QuietUninstallString) { $_.QuietUninstallString } else { $_.UninstallString })
  }
}) | ConvertTo-Json -Compress -Depth 3
