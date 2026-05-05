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
echo -e "${BOLD}  Context Keeper — Linux Installer${RESET}"
echo "  ─────────────────────────────────────────────────────────────────────"
echo ""
echo -e "  ${BOLD}STEP 1:${RESET}  Chrome will open at chrome://extensions"
echo "           Toggle ON ${YELLOW}\"Developer mode\"${RESET} (top-right switch)."
echo ""
echo -e "  ${BOLD}STEP 2:${RESET}  Click ${YELLOW}\"Load unpacked\"${RESET}"
echo ""
echo -e "  ${BOLD}STEP 3:${RESET}  A folder picker will open."
echo "           Select the ${CYAN}TabNotes${RESET} folder that just opened in your file manager."
echo ""
echo -e "  ${BOLD}STEP 4:${RESET}  Done! Pin TabNotes from the Extensions toolbar."
echo -e "           Use ${GREEN}Ctrl+Shift+Y${RESET} to open it anytime."
echo ""
echo "  ─────────────────────────────────────────────────────────────────────"
echo "  Opening Chrome and the TabNotes folder now..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Open file manager (try common ones in order)
if command -v xdg-open &>/dev/null; then
  xdg-open "$SCRIPT_DIR" &
elif command -v nautilus &>/dev/null; then
  nautilus "$SCRIPT_DIR" &
elif command -v dolphin &>/dev/null; then
  dolphin "$SCRIPT_DIR" &
elif command -v thunar &>/dev/null; then
  thunar "$SCRIPT_DIR" &
else
  echo -e "  ${YELLOW}No file manager found — navigate manually to: $SCRIPT_DIR${RESET}"
fi

sleep 0.5

# Open Chrome/Chromium at extensions page
BROWSER_CMDS=(
  "google-chrome"
  "google-chrome-stable"
  "chromium"
  "chromium-browser"
)

OPENED=false
for cmd in "${BROWSER_CMDS[@]}"; do
  if command -v "$cmd" &>/dev/null; then
    "$cmd" "chrome://extensions" &>/dev/null &
    OPENED=true
    break
  fi
done

if [ "$OPENED" = false ]; then
  echo -e "  ${YELLOW}Chrome/Chromium not found — please open chrome://extensions manually.${RESET}"
fi

echo ""
echo -e "  ${GREEN}Both windows are now open. Follow the steps above.${RESET}"
echo ""
