@echo off
setlocal

if "%PLUGIN_ROOT%"=="" (
  set "PLUGIN_ROOT=%~dp0.."
)

where node >nul 2>nul
if errorlevel 1 (
  echo {"systemMessage":"[gai2-native-guard] Node.js is required to run the hook."}
  exit /b 0
)

node "%PLUGIN_ROOT%\hooks\gai2-native-guard.mjs"
