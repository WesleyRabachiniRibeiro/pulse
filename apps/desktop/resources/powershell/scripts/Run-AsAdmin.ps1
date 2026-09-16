param([string]$ParamsJson)

$ErrorActionPreference = 'Stop'
$p = $ParamsJson | ConvertFrom-Json

$exe = [string]$p.exe
$targetArgs = @($p.args)
$timeoutMs = [int]$p.timeoutMs

$outputFile = Join-Path $env:TEMP ("pulse-" + [guid]::NewGuid().ToString() + ".txt")
$innerScript = Join-Path $PSScriptRoot 'Run-Elevated-Inner.ps1'
$innerParams = (@{ exe = $exe; args = $targetArgs; outputFile = $outputFile } | ConvertTo-Json -Compress -Depth 5)

$psArgs = @(
  '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
  '-File', $innerScript,
  '-ParamsJson', $innerParams
)

# 1223 = ERROR_CANCELLED (recusado na janela do UAC); -1224 = não deu para nem
# abrir a janela de elevação; -1225 = terminou sem dizer o código de saída.
$REFUSED_BY_USER = 1223
$START_FAILED = -1224

try {
  $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList $psArgs -Verb RunAs -WindowStyle Hidden -PassThru
  $exited = $proc.WaitForExit($timeoutMs)
  if (-not $exited) {
    try { $proc.Kill() } catch {}
    $code = $START_FAILED
  } else {
    $code = $proc.ExitCode
  }
} catch [System.ComponentModel.Win32Exception] {
  $code = if ($_.Exception.NativeErrorCode -eq $REFUSED_BY_USER) { $REFUSED_BY_USER } else { $START_FAILED }
} catch {
  $code = $START_FAILED
}

$text = ''
if (Test-Path $outputFile) {
  $text = (Get-Content -Raw -Path $outputFile -ErrorAction SilentlyContinue) -replace '^\xEF\xBB\xBF', ''
  Remove-Item -Path $outputFile -Force -ErrorAction SilentlyContinue
}
if (-not $text) { $text = '' }

[pscustomobject]@{ code = $code; text = $text } | ConvertTo-Json -Compress
