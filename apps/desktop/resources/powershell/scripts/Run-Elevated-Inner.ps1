param([string]$ParamsJson)

$ErrorActionPreference = 'SilentlyContinue'
$p = $ParamsJson | ConvertFrom-Json

$exe = [string]$p.exe
$targetArgs = @($p.args)
$outputFile = [string]$p.outputFile

& $exe @targetArgs *> $outputFile
$code = $LASTEXITCODE
if ($null -eq $code) { $code = -1225 }
exit $code
