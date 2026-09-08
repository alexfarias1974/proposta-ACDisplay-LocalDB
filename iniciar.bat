@echo off
echo ===========================================
echo   AC Display - Plataforma de Propostas
echo ===========================================
echo.

if not exist node_modules (
  echo Primeira execucao detectada. Instalando dependencias...
  call npm install
  echo Dependencias instaladas!
  echo.
)

echo Iniciando servidor local na porta 3001...
start http://localhost:3001
node server.js
pause 
