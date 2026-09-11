$ErrorActionPreference = 'SilentlyContinue'

$keys = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
@(Get-ItemProperty $keys | Where-Object { $_.DisplayName -and ($_.QuietUninstallString -or $_.UninstallString) } | ForEach-Object {
  [pscustomobject]@{
    name  = [string]$_.DisplayName
    quiet = [string]$_.QuietUninstallString
    plain = [string]$_.UninstallString
  }
}) | ConvertTo-Json -Compress -Depth 3
