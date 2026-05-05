@echo off
title TabNotes — Quick Install
color 0D

echo.
echo  ████████╗ █████╗ ██████╗ ███╗   ██╗ ██████╗ ████████╗███████╗███████╗
echo     ██╔══╝██╔══██╗██╔══██╗████╗  ██║██╔═══██╗╚══██╔══╝██╔════╝██╔════╝
echo     ██║   ███████║██████╔╝██╔██╗ ██║██║   ██║   ██║   █████╗  ███████╗
echo     ██║   ██╔══██║██╔══██╗██║╚██╗██║██║   ██║   ██║   ██╔══╝  ╚════██║
echo     ██║   ██║  ██║██████╔╝██║ ╚████║╚██████╔╝   ██║   ███████╗███████║
echo     ╚═╝   ╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚══════╝╚══════╝
echo.
echo  Context Keeper — Chrome Extension Installer
echo  ─────────────────────────────────────────────────────────────────────
echo.
echo  STEP 1:  Chrome will open at chrome://extensions
echo           Toggle ON "Developer mode" (top-right switch).
echo.
echo  STEP 2:  Click "Load unpacked"
echo.
echo  STEP 3:  A folder picker will open.
echo           Select the TabNotes folder that just opened in Explorer.
echo.
echo  STEP 4:  Done! Pin TabNotes from the Extensions toolbar.
echo           Use Ctrl+Shift+Y (Win/Linux) or Cmd+Shift+Y (Mac) to open it.
echo.
echo  ─────────────────────────────────────────────────────────────────────
echo  Opening Chrome and the TabNotes folder now...
echo.

:: Open the TabNotes folder in File Explorer
explorer "%~dp0"

:: Give Explorer a moment then open Chrome at the extensions page
timeout /t 1 /nobreak >nul

:: Try Chrome first, fall back to the default browser
start "" "chrome://extensions" 2>nul
if errorlevel 1 (
    start "" "https://chromewebstore.google.com/extensions" 2>nul
)

echo  Both windows are now open. Follow the steps above.
echo.
echo  Press any key to close this window...
pause >nul
