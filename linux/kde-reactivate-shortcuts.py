#!/usr/bin/env python3
"""Reativa no KDE os atalhos globais do Chrome (KDE Plasma >= 6.7.4, Wayland).

Desde o xdg-desktop-portal-kde 6.7.4, um atalho global só fica ativo quando o app chama
BindShortcuts na sessão atual (https://bugs.kde.org/show_bug.cgi?id=523063). O Chrome, ao abrir,
só chama CreateSession + ListShortcuts; como os atalhos já aparecem na lista, ele não chama
BindShortcuts. Resultado: os atalhos continuam configurados no KDE, mas ficam inativos, e as
teclas só funcionam com o Chrome em foco.

Este script fica rodando em segundo plano: quando o Chrome tem uma sessão de atalhos aberta e o
grupo dele no KDE está inativo, marca como "presentes" os atalhos que têm tecla definida. Nenhuma
tecla é alterada (é o mesmo que o KDE faria se o Chrome chamasse BindShortcuts).

Uso: kde-reactivate-shortcuts.py [--once] [componente ...]   (padrão: com.google.Chrome)
"""
import json
import subprocess
import sys
import time

INTERVAL = 3  # segundos entre verificações
SESSION_MARK = 'chrome_global_shortcuts'  # nome da sessão que o Chrome abre no portal
SET_PRESENT = 2  # KGlobalAccel::SetPresent (sem NoAutoloading: mantém as teclas salvas)
KGA = 'org.kde.kglobalaccel'


def log(msg):
    print(f'kde-reactivate-shortcuts: {msg}', file=sys.stderr, flush=True)


def busctl(*args, json_out=True):
    cmd = ['busctl', '--user', *(['--json=short'] if json_out else []), *args]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    if r.returncode:
        raise RuntimeError(r.stderr.strip() or f'busctl falhou: {args}')
    return json.loads(r.stdout) if json_out and r.stdout.strip() else r.stdout


def chrome_session_open():
    try:
        return SESSION_MARK in busctl('tree', '--list', 'org.freedesktop.portal.Desktop', json_out=False)
    except RuntimeError:
        return False


def component_path(name):
    try:
        return busctl('call', KGA, '/kglobalaccel', 'org.kde.KGlobalAccel', 'getComponent', 's', name)['data'][0]
    except RuntimeError:
        return None  # componente ainda não existe no KDE


def is_active(path):
    return busctl('call', KGA, path, 'org.kde.kglobalaccel.Component', 'isActive')['data'][0]


def activate(path):
    infos = busctl('call', KGA, path, 'org.kde.kglobalaccel.Component', 'allShortcutInfos')['data'][0]
    done = []
    for action, action_name, comp, comp_name, _ctx, _ctx_name, keys, _default in infos:
        if not keys:
            continue
        # actionId = [componente, ação, nome do componente, nome da ação]; keys: a(ai), uma tecla por item.
        args = ['setShortcutKeys', 'asa(ai)u', '4', comp, action, comp_name, action_name, str(len(keys))]
        for k in keys:
            args += ['1', str(k)]
        busctl('call', KGA, '/kglobalaccel', 'org.kde.KGlobalAccel', *args, str(SET_PRESENT))
        done.append(action_name)
    return done


def check(components):
    if not chrome_session_open():
        return
    for name in components:
        path = component_path(name)
        if path and not is_active(path):
            done = activate(path)
            if done:
                log(f'{name}: reativados {len(done)} atalhos ({", ".join(done)})')


def main():
    args = sys.argv[1:]
    once = '--once' in args
    components = [a for a in args if a != '--once'] or ['com.google.Chrome']
    while True:
        try:
            check(components)
        except Exception as e:  # noqa: BLE001 — um erro passageiro não pode derrubar o loop
            log(f'erro: {e}')
        if once:
            return
        time.sleep(INTERVAL)


if __name__ == '__main__':
    main()
