# YTM Control

Extensão do Chrome para o YouTube Music: curtir, adicionar/remover de playlists, seletor de playlist
com busca, 10 playlists rápidas e atalhos configuráveis, inclusive globais (com o Chrome em segundo plano).

## Instalar / atualizar

```bash
./install.sh
```

O script copia a extensão para `~/.local/share/ytm-control/extension`.

- **Primeira vez:** em `chrome://extensions`, ative o **Modo do desenvolvedor**, clique em
  **Carregar sem compactação** e escolha essa pasta.
- **Atualização:** clique em ↻ no card da YTM Control e recarregue a aba do YouTube Music.

O ID da extensão é fixo (`nkeogbpipkegbbihonkimhiphokagdld`, definido pela `key` do manifest), então
configurações e atalhos se mantêm entre atualizações.

## Atalhos

| Tipo | Onde configurar | Funciona em segundo plano? |
|---|---|---|
| Na página (padrão: `Alt+L` curtir, `Alt+Shift+L` não gostei, `Alt+P` seletor) | Opções da extensão (clique no ícone) | Não |
| Globais (curtir, não gostei, seletor, tocar/pausar, próxima/anterior, playlists rápidas 1–10) | `chrome://extensions/shortcuts` → escopo **Global**; no KDE/Wayland a tecla é definida em Configurações do Sistema → Teclado → Atalhos → **Google Chrome** | Sim |

As playlists rápidas são escolhidas nas opções da extensão (botão **Carregar playlists** com uma música tocando).
Quando a aba do YouTube Music não está à vista, os atalhos globais mostram o resultado como notificação do sistema.

## Como funciona

- `extension/page.js` roda na página: clica nos botões do player (curtir, próxima…) e usa a API
  interna do YouTube Music (InnerTube) com a sua sessão para listar e editar playlists.
- `extension/content.js`: atalhos na página, aviso na tela e seletor de playlist.
- `extension/background.js`: recebe os atalhos do Chrome e encaminha para a aba do YouTube Music.
- `extension/options.*`: página de configurações.

Se o Google mudar o site, o que pode quebrar são os seletores dos botões (`BUTTONS` em `page.js`)
ou o formato da API de playlists.

## Remover

```bash
./install.sh --uninstall
```
