#!/usr/bin/env python3
"""Install the pinned Cursor sidecar on FSD; never sends model requests.

Run as root on Linux. Credentials must already be in a private local directory.
The existing Copilot, Antigravity and dashboard services are not restarted.
"""

import argparse
import datetime
import hashlib
import io
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import subprocess
import tarfile
import tempfile
import time
import urllib.request


SOURCE = Path(__file__).resolve().parent
APP = Path('/opt/cursor-proxy')
STATE = Path('/var/lib/cursor-proxy')
UNIT = Path('/etc/systemd/system/cursor-proxy.service')
SNIPPET = Path('/etc/nginx/snippets/cursor-proxy.conf')
INCLUDE = 'include /etc/nginx/snippets/cursor-proxy.conf;'


def run(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f'{args[0]} {args[1:]} failed: {result.stderr.strip() or result.stdout.strip()}')
    return result.stdout.strip()


def atomic_write(path, data, mode, uid=0, gid=0):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as out:
        temporary = Path(out.name)
        out.write(data)
    try:
        temporary.chmod(mode)
        os.chown(temporary, uid, gid)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--auth-file', type=Path, required=True, help='private Cursor OAuth JSON')
    parser.add_argument('--client-key-file', type=Path, required=True, help='private FSD Cursor client key')
    parser.add_argument('--nginx-site', type=Path, default=Path('/etc/nginx/sites-enabled/edge-fsd.japaneast.cloudapp.azure.com'))
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error('Run as root on the FSD Linux VM')

    auth_bytes = args.auth_file.read_bytes()
    auth = json.loads(auth_bytes)
    if auth.get('type') != 'cursor' or not auth.get('access_token') or auth.get('disabled'):
        parser.error('Expected enabled Cursor credentials with an access token')
    key = args.client_key_file.read_text().strip()
    if not re.fullmatch(r'sk-cursor-[A-Za-z0-9_-]{32,}', key):
        parser.error('Expected a dedicated sk-cursor- key with at least 32 random characters')

    site = args.nginx_site.resolve(strict=True)
    previous_site = site.read_text()
    if INCLUDE in previous_site:
        candidate_site = previous_site
    else:
        if re.search(r'location\s+[^\n{]*/cursor', previous_site):
            parser.error('Existing /cursor locations need a deliberate migration')
        anchor = re.search(r'(?m)^(\s*)location \^~ /antigravity/v1/', previous_site)
        if anchor is None:
            parser.error('Cannot locate the existing FSD HTTPS Antigravity location')
        candidate_site = previous_site[:anchor.start()] + anchor[1] + INCLUDE + '\n' + previous_site[anchor.start():]

    release = json.loads((SOURCE / 'release.json').read_text())
    executable = APP / release['executable']
    binary = executable.read_bytes() if executable.is_file() else b''
    if hashlib.sha256(binary).hexdigest() != release['executableSha256']:
        with urllib.request.urlopen(release['url'], timeout=120) as response:
            archive = response.read()
        if hashlib.sha256(archive).hexdigest() != release['sha256']:
            raise RuntimeError('Release archive SHA-256 mismatch')
        with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as tar:
            members = [m for m in tar.getmembers() if m.isfile() and Path(m.name).name == release['executable']]
            if len(members) != 1:
                raise RuntimeError('Expected exactly one release executable')
            binary = tar.extractfile(members[0]).read()
        if hashlib.sha256(binary).hexdigest() != release['executableSha256']:
            raise RuntimeError('Release executable SHA-256 mismatch')

    try:
        user = pwd.getpwnam('cursor-proxy')
    except KeyError:
        run('useradd', '--system', '--home-dir', str(STATE), '--shell', '/usr/sbin/nologin', 'cursor-proxy')
        user = pwd.getpwnam('cursor-proxy')
    APP.mkdir(mode=0o755, exist_ok=True)
    for directory in [STATE, STATE / 'auth']:
        directory.mkdir(mode=0o700, exist_ok=True)
        directory.chmod(0o700)
        os.chown(directory, user.pw_uid, user.pw_gid)

    config = (SOURCE / 'config.example.yaml').read_text().replace('__CLIENT_API_KEY_JSON__', json.dumps(key))
    auth_target = STATE / 'auth' / args.auth_file.name
    changes = [
        (executable, binary, 0o755, 0, 0),
        (auth_target, auth_bytes, 0o600, user.pw_uid, user.pw_gid),
        (STATE / 'config.yaml', config.encode(), 0o600, user.pw_uid, user.pw_gid),
        (UNIT, (SOURCE / 'cursor-proxy.service').read_bytes(), 0o644, 0, 0),
        (SNIPPET, (SOURCE / 'nginx.conf').read_bytes(), 0o644, 0, 0),
        (site, candidate_site.encode(), 0o644, 0, 0),
    ]
    backup = Path('/root/cursor-proxy-deployment') / datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup.mkdir(parents=True, mode=0o700)
    backup.parent.chmod(0o700)
    previous = []
    for target, *_ in changes:
        snapshot = backup / target.relative_to('/')
        if target.exists():
            snapshot.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, snapshot)
            stat = target.stat()
            previous.append((target, snapshot, stat.st_mode & 0o777, stat.st_uid, stat.st_gid))
        else:
            previous.append((target, None, 0, 0, 0))
    active = subprocess.run(['systemctl', 'is-active', '--quiet', 'cursor-proxy']).returncode == 0
    enabled = subprocess.run(['systemctl', 'is-enabled', '--quiet', 'cursor-proxy']).returncode == 0
    try:
        for target, data, mode, uid, gid in changes:
            atomic_write(target, data, mode, uid, gid)
        run('nginx', '-t')
        run('systemctl', 'daemon-reload')
        run('systemctl', 'restart', 'cursor-proxy')
        time.sleep(2)
        run('systemctl', 'is-active', '--quiet', 'cursor-proxy')
        run('systemctl', 'enable', 'cursor-proxy')
        run('systemctl', 'reload', 'nginx')
    except Exception:
        for target, snapshot, mode, uid, gid in reversed(previous):
            if snapshot is None:
                target.unlink(missing_ok=True)
            else:
                atomic_write(target, snapshot.read_bytes(), mode, uid, gid)
        run('systemctl', 'daemon-reload')
        run('systemctl', 'restart' if active else 'stop', 'cursor-proxy')
        if not enabled:
            run('systemctl', 'disable', 'cursor-proxy')
        run('nginx', '-t')
        run('systemctl', 'reload', 'nginx')
        raise
    receipt = {
        'version': release['version'],
        'archiveSha256': release['sha256'],
        'executableSha256': hashlib.sha256(binary).hexdigest(),
        'baseUrl': 'https://edge-fsd.japaneast.cloudapp.azure.com/cursor',
        'backup': str(backup),
        'sourceFiles': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCE.iterdir() if p.is_file()},
        'inferenceTestsRun': False,
    }
    atomic_write(backup / 'receipt.json', (json.dumps(receipt, indent=2) + '\n').encode(), 0o600)
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
