# YTM Control

A small Chrome extension that adds the keyboard shortcuts YouTube Music is missing:
**like a song, add it to a playlist, or pick a playlist with fuzzy search — without touching the mouse,
even with Chrome in the background.**

> Made for personal use and shared as-is. It works on my machine (Fedora + KDE Plasma + Chrome);
> if it works on yours too, enjoy. The UI is in Portuguese (pt-BR) — PRs with translations are welcome.

## Features

- **Like / dislike** the current song.
- **Add / remove the current song to / from any playlist** of your account.
- **Playlist picker**: a quick search box over your playlists (`Alt+P`), with a ✓ on the ones that already have the song.
- **10 quick playlists**: bind a key to "add to playlist N" and set which playlist N is.
- **In-page shortcuts**, fully configurable (defaults: `Alt+L` like, `Alt+Shift+L` dislike, `Alt+P` picker).
- **Global shortcuts** through Chrome (like, dislike, picker, play/pause, next, previous, quick playlists 1–10).
  When the YouTube Music tab isn't visible, the result shows up as a system notification.
- No servers, no accounts, no tracking. Everything runs in your browser.

## Install

There's no Chrome Web Store release; you load it as an unpacked extension.

1. Clone the repo:
   ```bash
   git clone https://github.com/GabrielAhlert/ytm-control.git
   ```
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Reload your YouTube Music tab.

Works on Chrome and other Chromium-based browsers (Brave, Edge, Vivaldi…) on any OS.

**Linux helper (optional):** `./install.sh` copies the extension to `~/.local/share/ytm-control/extension`,
so Chrome doesn't depend on where you keep the repo. Load that folder instead, and after a `git pull`
run `./install.sh` again and hit ↻ on the extension card. `./install.sh --uninstall` removes it.

## Setup

Click the extension icon to open its options page:

1. With a song playing on YouTube Music, click **Carregar playlists** (load playlists).
2. **Atalhos dentro do YouTube Music** (in-page shortcuts): click a shortcut to record a new key combo,
   pick an action, and for add/remove pick the playlist.
3. **Playlists rápidas** (quick playlists): choose which playlist each of the 10 slots adds to.

### Global shortcuts

Open `chrome://extensions/shortcuts`, find YTM Control, set a key and change the scope to **Global**.

On **Linux with Wayland**, Chrome can't grab global keys by itself: when you switch to *Global*, it asks the
desktop to register the shortcut, and the key is chosen in the system settings.
On KDE Plasma: *System Settings → Keyboard → Shortcuts → Google Chrome*. (The first time, KDE pops up a dialog
on its own.)

Pick combos that don't clash with other apps — a global `Ctrl+L` will steal the address bar shortcut everywhere.
`Meta+Shift+<key>` is usually free.

## How it works

| File | Role |
|---|---|
| `extension/page.js` | Runs in the page itself. Clicks the player buttons (like, next…) and calls YouTube Music's own internal API (InnerTube) with your existing session to list and edit playlists. |
| `extension/content.js` | In-page shortcuts, the on-screen toast and the playlist picker. Bridges `background.js` and `page.js`. |
| `extension/background.js` | Receives Chrome's global shortcuts and routes them to the YouTube Music tab; shows notifications. |
| `extension/options.*` | Options page. |

The manifest has a fixed `key`, so the extension ID is always `nkeogbpipkegbbihonkimhiphokagdld` and your
settings and shortcuts survive reinstalls.

## Privacy

The extension only runs on `music.youtube.com`. To edit playlists it makes the same requests the YouTube Music
website makes, from your own tab, using your own session. Nothing is sent anywhere else, and settings are stored
in Chrome's extension storage.

Permissions: `storage` (settings), `scripting` (re-inject into an already open tab after an update),
`notifications` (results of global shortcuts), and access to `music.youtube.com`.

## Limitations

- It relies on YouTube Music's **internal, undocumented API** and on the page's HTML. If Google changes either,
  things can break. The places to fix are `BUTTONS` and the InnerTube calls in `page.js`.
- One YouTube Music tab is expected. With several, the one playing audio wins.
- You need to be signed in to YouTube Music.

## Troubleshooting

- **Nothing happens:** reload the YouTube Music tab; check the extension card in `chrome://extensions` for an
  *Errors* button.
- **"Playlist rápida N não configurada":** pick a playlist for that slot in the options page.
- **Media keys (next/previous) stop working after a while on KDE:** not this extension's fault, but a common
  one — the *Plasma Integration* extension registers a second media player without next/previous support, and KDE
  sometimes routes the keys to it. Disable **Enhanced media controls** in Plasma Integration's options.

## Contributing

Issues and PRs are welcome, especially translations (the UI strings live in `content.js`, `options.html`,
`options.js` and `page.js`), or fixes when YouTube Music changes.

## License

[MIT](LICENSE)

Not affiliated with, endorsed by, or sponsored by Google or YouTube. YouTube Music is a trademark of Google LLC.
