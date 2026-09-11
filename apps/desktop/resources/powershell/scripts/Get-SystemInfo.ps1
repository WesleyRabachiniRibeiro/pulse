$ErrorActionPreference = 'SilentlyContinue'

$k   = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$cs  = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor -Property VirtualizationFirmwareEnabled | Select-Object -First 1
$wg  = try { (winget --version) -replace '^v', '' } catch { $null }
$adm = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

[pscustomobject]@{
  product      = [string]$k.ProductName
  version      = if ($k.DisplayVersion) { [string]$k.DisplayVersion } else { [string]$k.ReleaseId }
  build        = [int]$k.CurrentBuild
  revision     = [int]$k.UBR
  admin        = [bool]$adm
  winget       = if ($wg) { [string]$wg } else { $null }
  hypervisor   = [bool]$cs.HypervisorPresent
  virtFirmware = [bool]$cpu.VirtualizationFirmwareEnabled
} | ConvertTo-Json -Compress
