$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $dir 'build\iocp_overlapped_server.exe'
$client = Join-Path $dir 'build\split_write_client.exe'
$rio = Join-Path $dir 'build\rio_iocp_loopback.exe'
foreach ($path in @($server, $client, $rio)) {
    if (-not (Test-Path $path)) { throw "Build first with build.bat: $path" }
}
$children = @()
function Wait-Checked($process, $label) {
    if (-not $process.WaitForExit(5000)) {
        $process.Kill()
        $process.WaitForExit()
        throw "$label exceeded the 5 second wrapper deadline"
    }
    $process.Refresh()
    if ($process.ExitCode -ne 0) { throw "$label failed with exit $($process.ExitCode)" }
}
try {
    $serverProcess = Start-Process -FilePath $server -PassThru -NoNewWindow
    $children += $serverProcess
    Start-Sleep -Milliseconds 250
    $clientProcess = Start-Process -FilePath $client -PassThru -NoNewWindow
    $children += $clientProcess
    Wait-Checked $clientProcess 'split-write client'
    Wait-Checked $serverProcess 'overlapped server'
    $rioProcess = Start-Process -FilePath $rio -PassThru -NoNewWindow
    $children += $rioProcess
    Wait-Checked $rioProcess 'RIO example'
    Write-Output 'RESULT: PASS iocp=drained rio=drained'
} finally {
    foreach ($process in $children) {
        if (-not $process.HasExited) { $process.Kill(); $process.WaitForExit() }
        $process.Dispose()
    }
}
