@echo off
title Gestor TI - Iniciando...
color 0A

:: Detecta o IP de rede local via ipconfig (evita conflito de quotes com PowerShell)
set NETWORK_IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    if not defined NETWORK_IP set NETWORK_IP=%%a
)
if defined NETWORK_IP set NETWORK_IP=%NETWORK_IP: =%
if not defined NETWORK_IP set NETWORK_IP=nao detectado

echo.
echo  ==========================================
echo   GESTOR TI - Iniciando servicos...
echo  ==========================================
echo.
echo  Acesso local:
echo   Front ^> http://localhost:5292
echo   Back  ^> http://localhost:3847
echo.
echo  Acesso em rede (outros dispositivos):
echo   Front ^> http://%NETWORK_IP%:5292
echo   Back  ^> http://%NETWORK_IP%:3847
echo.

:: Inicia o back-end em nova janela
start "Gestor TI - Back-end [:3847]" cmd /k "cd /d %~dp0back-end && echo [BACK-END] Iniciando servidor... && npm run dev"

:: Aguarda 2 segundos antes de iniciar o front-end
timeout /t 2 /nobreak >nul

:: Inicia o front-end em nova janela
start "Gestor TI - Front-end [:5292]" cmd /k "cd /d %~dp0front-end && echo [FRONT-END] Iniciando Vite... && npm run dev"

echo  Servicos iniciados em janelas separadas!
echo  Pressione qualquer tecla para fechar esta janela...
echo.
pause >nul
