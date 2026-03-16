@echo off
title Gestor TI - Iniciando...
color 0A

echo.
echo  ==========================================
echo   GESTOR TI - Iniciando servicos...
echo  ==========================================
echo.
echo  Back-end  : http://0.0.0.0:3847
echo  Front-end : http://0.0.0.0:5292
echo.
echo  Acesso local:
echo   Back  ^> http://localhost:3847
echo   Front ^> http://localhost:5292
echo.

:: Inicia o back-end em nova janela
start "Gestor TI - Back-end [:3847]" cmd /k "cd /d %~dp0back-end && echo [BACK-END] Iniciando servidor... && npm run dev"

:: Aguarda 2 segundos antes de iniciar o front-end
timeout /t 2 /nobreak >nul

:: Inicia o front-end em nova janela
start "Gestor TI - Front-end [:5292]" cmd /k "cd /d %~dp0front-end && echo [FRONT-END] Iniciando Vite... && npm run dev -- --host 0.0.0.0"

echo  Servicos iniciados em janelas separadas!
echo  Pressione qualquer tecla para fechar esta janela...
echo.
pause >nul
