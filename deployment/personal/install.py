#!/usr/bin/env python3
"""Install the committed personal GitHub.com sidecar on FSD using private local credentials."""

import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import time
import urllib.request


SOURCE = Path(__file__).resolve().parents[2]
APP = Path('/home/taoli1/copilot-personal')
STATE = Path('/home/taoli1/.local/share/copilot-personal')
UNIT = Path('/etc/systemd/system/copilot-personal.service')
SNIPPET = Path('/etc/nginx/snippets/copilot-personal.conf')
SITE = Path('/etc/nginx/sites-enabled/edge-fsd.japaneast.cloudapp.azure.com')
INCLUDE = 'include /etc/nginx/snippets/copilot-personal.conf;'


def run(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f'{args[0]} failed: {result.stderr.strip()}')
    return result.stdout.strip()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def existing_listeners():
    text = run('ss', '-ltnpH')
    return sorted(set(re.findall(r':(4141|4142|4143|4144|8317|8318)\s+.*?pid=(\d+)', text)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--token-file', type=Path, required=True)
    parser.add_argument('--key-file', type=Path, required=True)
    parser.add_argument('--expected-login', required=True)
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error('Run as root on FSD')
    if UNIT.exists() or SNIPPET.exists() or APP.exists() or STATE.exists():
        parser.error('Existing personal GitHub.com installation requires a deliberate upgrade')
    token = args.token_file.read_text().strip()
    key = args.key_file.read_text().strip()
    if not re.fullmatch(r'gh[ou]_[A-Za-z0-9_]+', token):
        parser.error('Expected a GitHub device-flow token')
    if not re.fullmatch(r'sk-personal-[A-Za-z0-9_-]{32,}', key):
        parser.error('Expected a dedicated random sk-personal- client key')
    identity_request = urllib.request.Request(
        'https://api.github.com/user',
        headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(identity_request, timeout=20) as response:
        login = json.load(response).get('login', '')
    if login.casefold() != args.expected_login.casefold():
        parser.error('Authorized GitHub login does not match --expected-login')
    run('python3', str(SOURCE / 'deployment/verify.py'), '--git',
        '--deployed-dashboard', '/var/www/edge-dash/index.html')
    commit = run('git', '-c', f'safe.directory={SOURCE}', '-C', str(SOURCE), 'rev-parse', 'HEAD')
    existing = [SOURCE / name for name in ['dist/main.js', 'dist/stable-ids.mjs', 'dist/responses-compat.mjs']]
    existing.append(Path('/var/www/edge-dash/index.html'))
    before = {str(path): digest(path) for path in existing}
    listeners_before = existing_listeners()
    if ':4145 ' in run('ss', '-ltnH'):
        parser.error('Port 4145 is already in use')
    site = SITE.resolve(strict=True)
    previous_site = site.read_bytes()
    text = previous_site.decode()
    if INCLUDE in text or re.search(r'location\s+[^\n{]*/personal', text):
        parser.error('A personal GitHub.com route already exists')
    anchor = 'include /etc/nginx/snippets/cursor-proxy.conf;'
    if text.count(anchor) != 1:
        parser.error('Cannot locate the FSD HTTPS server include')
    candidate_site = text.replace(anchor, INCLUDE + '\n    ' + anchor)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = Path('/root/copilot-personal-deployment') / stamp
    backup.mkdir(parents=True, mode=0o700)
    (backup / 'nginx-site.conf').write_bytes(previous_site)
    user = pwd.getpwnam('taoli1')
    APP.mkdir(exist_ok=True, mode=0o755)
    APP.chmod(0o755)
    os.chown(APP, user.pw_uid, user.pw_gid)
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    STATE.chmod(0o700)
    os.chown(STATE, user.pw_uid, user.pw_gid)
    for name, content in [('github_token', token), ('service.env', f'COPILOT_API_KEY={key}\nCOPILOT_API_KEY_NAMES=personal\n')]:
        target = STATE / name
        target.write_text(content)
        target.chmod(0o600)
        os.chown(target, user.pw_uid, user.pw_gid)
    target = APP / 'main.js'
    shutil.copyfile(SOURCE / 'dist/main.js', target)
    target.chmod(0o644)
    os.chown(target, user.pw_uid, user.pw_gid)
    package = APP / 'package.json'
    package.write_text('{"type":"module","private":true}\n')
    package.chmod(0o644)
    os.chown(package, user.pw_uid, user.pw_gid)
    modules = APP / 'node_modules'
    if not modules.exists():
        modules.symlink_to(SOURCE / 'node_modules', target_is_directory=True)
    if modules.resolve() != (SOURCE / 'node_modules').resolve():
        raise RuntimeError('Unexpected personal GitHub.com dependency directory')
    shutil.copyfile(SOURCE / 'deployment/personal/copilot-personal.service', UNIT)
    UNIT.chmod(0o644)
    activated = False
    try:
        run('systemctl', 'daemon-reload')
        run('systemctl', 'start', 'copilot-personal.service')
        models = None
        for _ in range(30):
            try:
                request = urllib.request.Request('http://127.0.0.1:4145/v1/models', headers={'Authorization': 'Bearer ' + key})
                with urllib.request.urlopen(request, timeout=5) as response:
                    models = json.load(response)
                if models.get('data'):
                    break
            except (OSError, ValueError):
                time.sleep(1)
        if not models or not models.get('data'):
            raise RuntimeError('personal GitHub.com model readiness check failed')
        shutil.copyfile(SOURCE / 'deployment/personal/nginx.conf', SNIPPET)
        SNIPPET.chmod(0o644)
        site.write_text(candidate_site)
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        run('systemctl', 'enable', 'copilot-personal.service')
        if before != {str(path): digest(path) for path in existing}:
            raise RuntimeError('An existing production artifact changed')
        if listeners_before != existing_listeners():
            raise RuntimeError('An existing proxy listener changed during deployment')
        receipt = {'commit': commit, 'utc': stamp, 'port': 4145, 'modelCount': len(models['data']), 'githubLogin': login,
                   'bundleSha256': digest(APP / 'main.js'), 'existingArtifactsUnchanged': True,
                   'existingListenersUnchanged': True,
                   'backup': str(backup), 'service': run('systemctl', 'is-active', 'copilot-personal.service')}
        (backup / 'receipt.json').write_text(json.dumps(receipt, indent=2))
        activated = True
        print(json.dumps(receipt))
    finally:
        if not activated:
            site.write_bytes(previous_site)
            SNIPPET.unlink(missing_ok=True)
            subprocess.run(['systemctl', 'disable', '--now', 'copilot-personal.service'], capture_output=True)
            UNIT.unlink(missing_ok=True)
            run('systemctl', 'daemon-reload')
            run('nginx', '-t')
            run('systemctl', 'reload', 'nginx')


if __name__ == '__main__':
    main()
