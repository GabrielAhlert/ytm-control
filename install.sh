#!/usr/bin/env bash
# Copia a extensão para ~/.local/share/ytm-control/extension (pasta carregada no Chrome).
# Assim o Chrome não depende de onde este repositório está. `./install.sh --uninstall` remove.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/ytm-control"

# Restos da versão 0.1 (ponte nativa + comando ytm).
rm -f "$HOME/.local/bin/ytm" "$DEST/ytm" \
  "$HOME/.config/google-chrome/NativeMessagingHosts/com.ytmcontrol.bridge.json" \
  "$HOME/.config/chromium/NativeMessagingHosts/com.ytmcontrol.bridge.json" \
  "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/ytm-control.sock"

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -rf "$DEST"
  echo "Removido. Tire a extensão em chrome://extensions."
  exit 0
fi

mkdir -p "$DEST"
rm -rf "$DEST/extension"
cp -r "$SRC/extension" "$DEST/extension"

cat <<EOF
Extensão copiada para $DEST/extension

Primeira vez: em chrome://extensions, ative o "Modo do desenvolvedor", clique em
"Carregar sem compactação" e escolha essa pasta.
Atualização: clique em ↻ (recarregar) no card da YTM Control e recarregue a aba do YouTube Music.
EOF
