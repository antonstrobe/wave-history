@echo off
cd /d "%~dp0"
start "" /b powershell.exe -NoProfile -ExecutionPolicy AllSigned -WindowStyle Hidden -File "%~dp0Start-Wave-History.ps1"
