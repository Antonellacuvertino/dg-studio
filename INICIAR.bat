@echo off
REM Abre DG Studio en tu computador (doble clic).
cd /d "%~dp0"
start "" http://localhost:5517/index.html
python -m http.server 5517 2>nul || py -m http.server 5517 2>nul || npx --yes http-server -p 5517 -c-1
