#!/usr/bin/env python3
"""Create a source-only download. Requires Python 3; never modifies source files.
Usage: python3 scripts/package-download.py /path/to/qareeb-ready.zip
"""
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root.parent / 'qareeb-ready.zip'
root_files = {
    'package.json', 'package-lock.json', 'README.md', 'START-HERE.md', 'DEPLOY.md',
    'Dockerfile', 'docker-compose.yml', 'render.yaml', 'railway.json', 'vercel.json',
    'netlify.toml', 'Procfile', '.nvmrc', '.gitignore', '.dockerignore', '.vercelignore',
}
source_dirs = {'api', 'client', 'server', 'scripts', 'supabase'}
skip_dirs = {'node_modules', 'dist', 'build', 'coverage', '.git', '.vite', '__pycache__', '.vercel', 'data', 'uploads'}


def allowed(p):
    rel = p.relative_to(root)
    if p.is_symlink() or not p.is_file():
        return False
    if len(rel.parts) == 1:
        return p.name in root_files
    if rel.parts[0] not in source_dirs or any(part in skip_dirs for part in rel.parts[:-1]):
        return False
    if p.name.startswith('.') and p.name != '.env.example':
        return False
    return p.suffix not in {'.db', '.log', '.zip', '.mp4', '.tsbuildinfo', '.pyc'}


output.parent.mkdir(parents=True, exist_ok=True)
# Prune runtime/dependency trees before walking; never inspect user data or dependencies.
import os
candidates = []
for folder, dirs, names in os.walk(root):
    dirs[:] = [d for d in dirs if d not in skip_dirs and not Path(folder, d).is_symlink() and (Path(folder) != root or d in source_dirs)]
    candidates.extend(Path(folder, name) for name in names)
files = sorted(p for p in candidates if allowed(p))
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in files:
        archive.write(file, Path('qareeb') / file.relative_to(root))
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None, 'Archive integrity check failed'
    for required in ['package.json', 'package-lock.json', 'client/vercel.json', 'api/index.js', 'supabase/schema.sql', 'supabase/demo.sql', 'supabase/storage.sql', 'START-HERE.md']:
        assert f'qareeb/{required}' in archive.namelist(), f'Missing {required}'
print(f'{output}: {len(files)} files, {output.stat().st_size / 1024 / 1024:.2f} MB; integrity checked')
