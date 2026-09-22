$ErrorActionPreference = 'Stop'
$project = $PSScriptRoot
$address = 'http://127.0.0.1:4173/admin/'
try {
    $status = Invoke-RestMethod 'http://127.0.0.1:4173/api/admin/session' -TimeoutSec 2
    if ($null -ne $status.needsSetup) {
        Write-Output "ROMPA já está disponível: $address"
        exit 0
    }
} catch { }
$runtime = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if (-not (Test-Path -LiteralPath $runtime)) { $runtime = (Get-Command node -ErrorAction Stop).Source }
$major = & $runtime -p 'process.versions.node.split(".")[0]'
if ([int]$major -lt 24) { throw 'O ROMPA requer Node.js 24 ou superior.' }
$dataDirectory = Join-Path $project '.data'
New-Item -ItemType Directory -Force -Path $dataDirectory | Out-Null
$serverScript = Join-Path $project 'scripts/serve.mjs'
$process = Start-Process -FilePath $runtime -ArgumentList ('"' + $serverScript + '"') -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dataDirectory 'server.log') -RedirectStandardError (Join-Path $dataDirectory 'server-error.log') -PassThru
Set-Content -LiteralPath (Join-Path $dataDirectory 'server.pid') -Value $process.Id
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 300
    try {
        $status = Invoke-RestMethod 'http://127.0.0.1:4173/api/admin/session' -TimeoutSec 1
        if ($null -ne $status.needsSetup) { Write-Output "Administração: $address"; Write-Output 'Teste: http://127.0.0.1:4173/teste/'; exit 0 }
    } catch { }
}
throw 'O servidor não iniciou. Consulte .data/server-error.log.'
