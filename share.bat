@echo off
echo ========================================
echo    Site Bourse - Partage en reseau
echo ========================================
echo.
echo Pour partager le site avec un ami, tu as 2 options :
echo.
echo === OPTION 1 : Reseau local (meme WiFi) ===
echo Ton ami doit etre sur le meme reseau WiFi.
echo.

REM Afficher l'IP locale
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    echo   Ton IP locale : %%a
)
echo.
echo   Lien a partager : http://TON_IP:5173
echo.

echo === OPTION 2 : ngrok (n'importe ou dans le monde) ===
echo 1. Installe ngrok : https://ngrok.com/download
echo 2. Cree un compte gratuit sur ngrok.com
echo 3. Lance : ngrok http 5173
echo 4. Partage le lien https://xxxx.ngrok-free.app
echo.
echo ========================================
echo.
echo Avant de partager, assure-toi que :
echo   - Le backend tourne  : cd backend ^&^& npm run dev
echo   - Le frontend tourne : cd frontend ^&^& npm run dev
echo.
pause
