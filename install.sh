#!/usr/bin/env bash
# Instala a YTM Control: copia a extensão e o comando `ytm` para ~/.local/share/ytm-control
# e registra a ponte de native messaging no Chrome. Use `./install.sh --uninstall` para remover.
set -euo pipefail

EXT_ID="nkeogbpipkegbbihonkimhiphokagdld"   # fixo, definido pela "key" do manifest.json
HOST_NAME="com.ytmcontrol.bridge"
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/ytm-control"
BIN="$HOME/.local/bin/ytm"
HOST_DIRS=("$HOME/.config/google-chrome/NativeMessagingHosts" "$HOME/.config/chromium/NativeMessagingHosts")

if [[ "${1:-}" == "--uninstall" ]]; then
  for d in "${HOST_DIRS[@]}"; do rm -f "$d/$HOST_NAME.json"; done
  rm -f "$BIN"
  rm -rf "$DEST"
  echo "Removido. Tire a extensão em chrome://extensions."
  exit 0
fi

mkdir -p "$DEST" "$(dirname "$BIN")"
rm -rf "$DEST/extension"
cp -r "$SRC/extension" "$DEST/extension"
install -m 755 "$SRC/native/ytm" "$DEST/ytm"
ln -sf "$DEST/ytm" "$BIN"

for d in "${HOST_DIRS[@]}"; do
  [[ -d "$(dirname "$d")" ]] || continue
  mkdir -p "$d"
  cat > "$d/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Ponte da extensão YTM Control",
  "path": "$DEST/ytm",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
EOF
done

cat <<EOF
Instalado.

1. Abra chrome://extensions, ative o "Modo do desenvolvedor" e clique em
   "Carregar sem compactação", escolhendo a pasta:
     $DEST/extension
2. Recarregue a aba do YouTube Music.
3. Teste no terminal:  ytm status

Se você mudar algo no código, rode ./install.sh de novo e clique em "Recarregar" na extensão.
EOF
