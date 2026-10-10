#!/usr/bin/env python3
"""Verify this checkout, its Git commit, and optionally the deployed dashboard.

This does not contact an API, read credentials, write files, or restart services.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--deployed-dashboard', type=Path)
    parser.add_argument('--git', action='store_true', help='require a clean index/worktree and compare runtime bytes to HEAD')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    manifest = json.loads((root / 'deployment/production-manifest.json').read_text(encoding='utf-8'))
    failures = []
    for name, expected in manifest['files'].items():
        file = (root / name).resolve()
        if not file.is_relative_to(root) or not file.is_file():
            failures.append(name + ': missing or invalid path')
        elif hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            failures.append(name + ': SHA-256 mismatch')
    if args.deployed_dashboard:
        if not args.deployed_dashboard.is_file() or args.deployed_dashboard.read_bytes() != (root / 'dashboard/index.html').read_bytes():
            failures.append('deployed dashboard differs from dashboard/index.html')
    git_commit = None
    if args.git:
        def git(*parts):
            return subprocess.check_output(['git', '-c', 'safe.directory=' + str(root), '-C', str(root), *parts])
        git_commit = git('rev-parse', 'HEAD').decode().strip()
        if git('status', '--porcelain'):
            failures.append('Git working tree or index is not clean')
        for name in manifest['files']:
            if git('show', 'HEAD:' + name) != (root / name).read_bytes():
                failures.append(name + ': differs from Git HEAD')
    print(json.dumps({'ok': not failures, 'commit': git_commit, 'checkedFiles': len(manifest['files']), 'failures': failures}, indent=2))
    raise SystemExit(1 if failures else 0)


if __name__ == '__main__':
    main()
