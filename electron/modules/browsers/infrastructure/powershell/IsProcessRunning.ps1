$ErrorActionPreference = 'SilentlyContinue'
if (Get-Process -Name $ProcessName) { 'sim' } else { 'nao' }
