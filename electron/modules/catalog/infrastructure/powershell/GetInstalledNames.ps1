$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$keys = @(
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$names = @(Get-ItemProperty $keys | Where-Object { $_.DisplayName } | ForEach-Object { [string]$_.DisplayName })
$names += @(try { Get-StartApps | ForEach-Object { [string]$_.Name } } catch { @() })
@($names | Sort-Object -Unique) | ConvertTo-Json -Compress
