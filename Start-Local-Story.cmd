@echo off
setlocal
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo The built game is missing. Run npm run build in this folder first.
  pause
  exit /b 1
)
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is needed to open the local game page.
  pause
  exit /b 1
)
call node -e "fetch('http://127.0.0.1:4188/',{signal:AbortSignal.timeout(1200)}).then(r=>{if(!r.ok||r.headers.get('Cross-Origin-Embedder-Policy')!=='require-corp') throw Error();}).catch(()=>{process.exitCode=1;})"
if not errorlevel 1 (
  start "" "http://127.0.0.1:4188/"
  exit /b 0
)
call node "node_modules\vite\bin\vite.js" preview --open
if errorlevel 1 pause
