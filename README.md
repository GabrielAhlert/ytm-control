# YTM Control

Extensão do Chrome + comando `ytm` para controlar o YouTube Music: curtir, adicionar/remover
de playlists, seletor de playlist com busca, atalhos configuráveis e uma API local para o sistema.

## Instalar

```bash
./install.sh
```

Depois, em `chrome://extensions`: ative o **Modo do desenvolvedor**, clique em **Carregar sem compactação**
e escolha `~/.local/share/ytm-control/extension`. Recarregue a aba do YouTube Music.

## Três formas de usar

| Onde | Como configurar | Funciona com o Chrome em segundo plano? |
|---|---|---|
| Atalhos na página (padrão: `Alt+L` curtir, `Alt+Shift+L` não gostei, `Alt+P` seletor) | Opções da extensão (clique no ícone) | Não |
| Atalhos globais do Chrome | `chrome://extensions/shortcuts`, escopo **Global** | Sim, mas pode falhar no Wayland |
| Comando `ytm` (terminal, scripts, atalhos do KDE) | `install.sh` | Sim |

### Atalho global no KDE

Configurações do sistema → Teclado → Atalhos → **Adicionar novo** → **Comando ou script**:

```
/home/SEU_USUARIO/.local/bin/ytm --notify like
/home/SEU_USUARIO/.local/bin/ytm --notify add "Nome da playlist"
/home/SEU_USUARIO/.local/bin/ytm pick
```

## Comando `ytm`

```
ytm like | dislike | play-pause | next | previous
ytm status | playlists
ytm add "playlist" | remove "playlist"   # aceita parte do nome, sem acento
ytm slot 1|2|3                           # playlists rápidas definidas nas opções
ytm pick                                 # abre o seletor na página
--json     saída em JSON
--notify   notificação do sistema
```

## Como funciona

- `extension/page.js` roda na página: clica nos botões do player (curtir, próxima…) e usa a API
  interna do YouTube Music (InnerTube) com a sua sessão para listar e editar playlists.
- `extension/content.js`: atalhos de teclado, aviso na tela e seletor de playlist.
- `extension/background.js`: recebe atalhos do Chrome e pedidos da ponte, e encaminha para a aba.
- `native/ytm`: quando o Chrome o executa, vira a ponte (socket Unix em `$XDG_RUNTIME_DIR/ytm-control.sock`,
  acessível só pelo seu usuário); quando você o executa, é o CLI.

Se o Google mudar o site, o que pode quebrar são os seletores dos botões (`BUTTONS` em `page.js`)
ou o formato da API de playlists.

## Remover

```bash
./install.sh --uninstall
```
