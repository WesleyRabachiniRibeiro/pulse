$ErrorActionPreference = 'SilentlyContinue'
$user = (Get-ItemProperty 'HKCU:\Software\Valve\Steam\ActiveProcess' -Name ActiveUser).ActiveUser
if ($user) { [string][int]$user } else { '0' }
