@echo off
REM Abre DG Studio en tu computador (doble clic).
cd /d "%~dp0"
start "" http://localhost:5517/index.html
python server.py 5517 2>nul || py server.py 5517
