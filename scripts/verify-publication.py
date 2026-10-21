#!/usr/bin/env python3
"""Check publishable paths and high-confidence sensitive-data patterns.

Run alongside gitleaks. Findings contain paths/categories, never secret values.
This check does not claim to recognize personal information in image pixels.
"""
from pathlib import Path
import argparse
import json
import os
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SKIP = {'.git', 'node_modules', 'target', 'dist', 'dist-ssr', '.runtime', '.private',
        '.venv', '__pycache__', 'coverage', '.cache', 'output', 'tmp'}
FORBIDDEN = {'.private', '.runtime', '.setup', 'node_modules', 'target', '.idea'}
KEY_EXT = {'.pem', '.key', '.p12', '.pfx', '.jks', '.keystore', '.dmg', '.part', '.pyc'}
PATTERNS = {
    'provider-token': re.compile(r'\b(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16})\b'),
    'private-key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'bearer-token': re.compile(r'(?i)\bBearer\s+[A-Za-z0-9_.=-]{30,}'),
    'operator-home': re.compile(r'/Users/' + r'(?!learner(?:/|\b))[^/\s"\'<>`\\]+'),
}

def scan_text(raw, label, issues):
    if b'\x00' in raw:
        return
    try:
        text = raw.decode('utf-8')
    except UnicodeDecodeError:
        return
    for category, pattern in PATTERNS.items():
        for match in pattern.finditer(text):
            # Pattern source code contains regex syntax, never a matching token.
            issues.append({'path': label, 'category': category,
                           'line': text.count('\n', 0, match.start()) + 1})

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tracked', action='store_true', help='Check only the current Git index paths')
    args = ap.parse_args()
    files = []
    if args.tracked:
        out = subprocess.run(['git', 'ls-files', '-z'], cwd=ROOT, capture_output=True, check=True).stdout
        files = [ROOT / n.decode('utf-8') for n in out.split(b'\x00') if n]
    else:
        for base, dirs, names in os.walk(ROOT):
            dirs[:] = [d for d in dirs if d not in SKIP]
            files.extend(Path(base, n) for n in names)
    issues = []
    total = 0
    for path in sorted(files):
        rel = path.relative_to(ROOT)
        label = rel.as_posix()
        if path.is_symlink():
            issues.append({'path': label, 'category': 'symlink'})
            continue
        name = path.name
        if any(p in FORBIDDEN for p in rel.parts) or path.suffix.lower() in KEY_EXT:
            issues.append({'path': label, 'category': 'private-or-generated-file'})
        if name == '.env' or (name.startswith('.env.') and not name.endswith(('.example', '.template', '.sample'))):
            issues.append({'path': label, 'category': 'local-environment'})
        if path.stat().st_size >= 95 * 1024 * 1024:
            issues.append({'path': label, 'category': 'oversized-git-blob'})
        raw = path.read_bytes()
        total += len(raw)
        scan_text(raw, label, issues)
        if path.suffix.lower() in {'.docx', '.xlsx', '.pptx', '.zip'}:
            with zipfile.ZipFile(path) as archive:
                if archive.testzip() is not None:
                    issues.append({'path': label, 'category': 'corrupt-archive'})
                for item in archive.infolist():
                    if not item.is_dir():
                        scan_text(archive.read(item), label + '!' + item.filename, issues)
    print(json.dumps({'status': 'PASS' if not issues else 'FAIL', 'files': len(files),
                      'bytes': total, 'issues': issues}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if issues else 0)

if __name__ == '__main__':
    main()
