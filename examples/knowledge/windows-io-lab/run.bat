@echo off
setlocal
if not exist "%~dp0build\iocp_overlapped_server.exe" (
  echo ERROR: Build first with examples\knowledge\windows-io-lab\build.bat. 1>&2
  exit /b 3
)
if not exist "%~dp0build\split_write_client.exe" (
  echo ERROR: Build first with examples\knowledge\windows-io-lab\build.bat. 1>&2
  exit /b 3
)
if not exist "%~dp0build\rio_iocp_loopback.exe" (
  echo ERROR: Build first with examples\knowledge\windows-io-lab\build.bat. 1>&2
  exit /b 3
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
set "status=%errorlevel%"
if not "%status%"=="0" echo RESULT: NOT_RUN_OR_FAIL exit=%status% 1>&2
exit /b %status%
