@echo off
mode con cols=120 lines=30
color 0A

:: Logo ASCII Quantify
echo.
echo   ██████  ██    ██  █████  ███    ██ ████████ ██ ███████ ██    ██ 
echo  ██    ██ ██    ██ ██   ██ ████   ██    ██    ██ ██       ██  ██  
echo  ██    ██ ██    ██ ███████ ██ ██  ██    ██    ██ █████     ████   
echo  ██ ▄▄ ██ ██    ██ ██   ██ ██  ██ ██    ██    ██ ██         ██    
echo   ██████   ██████  ██   ██ ██   ████    ██    ██ ██         ██    
echo      ▀▀                                                            
echo.

echo Vérification des processus existants sur les ports 3001 et 5000...

:: Vérifier si un processus écoute déjà sur le port 3001 (frontend)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Processus trouvé sur le port 3001 (PID: %%a)
    echo Arrêt du processus existant...
    taskkill /F /PID %%a
    echo Processus arrêté.
)

:: Vérifier si un processus écoute déjà sur le port 5000 (backend)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    echo Processus trouvé sur le port 5000 (PID: %%a)
    echo Arrêt du processus existant...
    taskkill /F /PID %%a
    echo Processus arrêté.
)

echo Démarrage du serveur backend (MongoDB) et frontend (Vite)...
cd /d %~dp0

:: Démarrer le serveur en mode complet (backend + frontend)
start /min cmd /c npm run dev:full

echo Serveur lancé avec succès en arrière-plan.
echo Démarrage du navigateur dans 3 secondes...
timeout /t 3 >nul

:: Ouvrir l'URL dans le navigateur par défaut
start http://localhost:3001

timeout /t 1 >nul
exit