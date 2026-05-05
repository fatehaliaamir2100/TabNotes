#!/usr/bin/env bash
set -euo pipefail

CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'

clear
echo ""
echo -e "${CYAN}${BOLD}"
echo "  ████████╗ █████╗ ██████╗ ███╗   ██╗ ██████╗ ████████╗███████╗███████╗"
echo "     ██╔══╝██╔══██╗██╔══██╗████╗  ██║██╔═══██╗╚══██╔══╝██╔════╝██╔════╝"
echo "     ██║   ███████║██████╔╝██╔██╗ ██║██║   ██║   ██║   █████╗  ███████╗"
echo "     ██║   ██╔══██║██╔══██╗██║╚██╗██║██║   ██║   ██║   ██╔══╝  ╚════██║"
echo "     ██║   ██║  ██║██████╔╝██║ ╚████║╚██████╔╝   ██║   ███████╗███████║"
echo "     ╚═╝   ╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚══════╝╚══════╝"
echo -e "${RESET}"
echo -e "${BOLD}  Context Keeper — macOS Installer${RESET}"
echo "  ─────────────────────────────────────────────────────────────────────"
echo ""
echo -e "  ${BOLD}STEP 1:${RESET}  Chrome will open at chrome://extensions"
echo "           Toggle ON ${YELLOW}\"Developer mode\"${RESET} (top-right switch)."
echo ""
echo -e "  ${BOLD}STEP 2:${RESET}  Click ${YELLOW}\"Load unpacked\"${RESET}"
echo ""
echo -e "  ${BOLD}STEP 3:${RESET}  A folder picker will open."
echo "           Select the ${CYAN}TabNotes${RESET} folder that just appeared in Finder."
echo ""
echo -e "  ${BOLD}STEP 4:${RESET}  Done! Pin TabNotes from the Extensions toolbar."
echo -e "           Use ${GREEN}Cmd+Shift+Y${RESET} to open it anytime."
echo ""
echo "  ─────────────────────────────────────────────────────────────────────"
echo "  Opening Chrome and the TabNotes folder now..."
echo ""

# Open this folder in Finder
open "$(dirname "$0")"

# Short delay so Finder settles
sleep 0.5

# Try to open Chrome at the extensions page
CHROME_PATHS=(
  "/Applications/Google Chrome.app"
  "/Applications/Chromium.app"
  "$HOME/Applications/Google Chrome.app"
)

OPENED=false
for path in "${CHROME_PATHS[@]}"; do
  if [ -d "$path" ]; then
    open -a "$path" "chrome://extensions"
    OPENED=true
    break
  fi
done

if [ "$OPENED" = false ]; then
  echo -e "  ${YELLOW}Chrome not found — please open chrome://extensions manually.${RESET}"
fi

echo ""
echo -e "  ${GREEN}Both windows are now open. Follow the steps above.${RESET}"
echo ""
