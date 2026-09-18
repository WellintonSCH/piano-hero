@echo off
REM Sobe um servidor local e abre o jogo no navegador.
REM Precisa disso porque o navegador bloqueia o carregamento dos sons de piano
REM (e o Web MIDI) quando o index.html é aberto direto com duplo-clique (file://).

cd /d "%~dp0"

echo Iniciando servidor local em http://localhost:8000 ...
start "" http://localhost:8000
python -m http.server 8000

pause
