@echo off
setlocal
if not defined VCToolsInstallDir (
  echo ERROR: Open a Visual Studio Developer Command Prompt first. 1>&2
  exit /b 3
)
if not exist "%~dp0build" mkdir "%~dp0build"
cl /nologo /W4 /EHsc /std:c++17 /permissive- /DWIN32_LEAN_AND_MEAN /I"%~dp0" "%~dp0iocp_overlapped_server.cpp" /Fe:"%~dp0build\iocp_overlapped_server.exe" /link Ws2_32.lib
if errorlevel 1 exit /b %errorlevel%
cl /nologo /W4 /EHsc /std:c++17 /permissive- /DWIN32_LEAN_AND_MEAN /I"%~dp0" "%~dp0split_write_client.cpp" /Fe:"%~dp0build\split_write_client.exe" /link Ws2_32.lib
if errorlevel 1 exit /b %errorlevel%
cl /nologo /W4 /EHsc /std:c++17 /permissive- /DWIN32_LEAN_AND_MEAN /I"%~dp0" "%~dp0rio_iocp_loopback.cpp" /Fe:"%~dp0build\rio_iocp_loopback.exe" /link Ws2_32.lib
if errorlevel 1 exit /b %errorlevel%
echo PASS build output=%~dp0build
exit /b 0
