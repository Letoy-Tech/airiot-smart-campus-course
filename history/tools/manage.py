#!/usr/bin/env python3
"""Verify/finalize sanitized historical objects or reconstruct one package.

Source ZIP hashes identify local historical inputs only. The entries' sha256
values refer to the current published derivative and must be refreshed after
every sanitization change. Restoration never executes historical code.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import shutil
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]

def digest(data):
    return hashlib.sha256(data).hexdigest()

def safe_relative(value):
    path = PurePosixPath(value)
    if path.is_absolute() or '..' in path.parts or '\\' in value:
        raise ValueError('Unsafe manifest path')
    return path

def manifests():
    return sorted((ROOT / 'packages').glob('*/manifest.json'))

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def finalize(reviewed):
    if not reviewed:
        raise SystemExit('Review/sanitize historical content first; then pass --sanitization-reviewed.')
    moves = {}
    materialized = {}
    updated_manifests = []
    keep = set()
    total = 0
    for manifest_path in manifests():
        manifest = load(manifest_path)
        for entry in manifest['entries']:
            old = entry['object']
            if old not in moves:
                source = ROOT / safe_relative(old)
                data = source.read_bytes()
                sha = digest(data)
                suffix = source.suffix
                target_relative = f'objects/{sha[:2]}/{sha}{suffix}'
                if target_relative in materialized and materialized[target_relative] != data:
                    raise RuntimeError('Object collision')
                materialized[target_relative] = data
                moves[old] = (target_relative, sha, len(data))
            target_relative, sha, size = moves[old]
            entry.update(object=target_relative, sha256=sha, bytes=size)
            keep.add(target_relative)
            total += 1
        manifest['publicationStatus'] = 'sanitization-reviewed-hashes-finalized'
        manifest['integrityScope'] = 'sha256 describes this sanitized derivative, not the original source ZIP members'
        updated_manifests.append((manifest_path, manifest))
    # Read every provisional object before replacing any content-addressed name.
    # An old name may already equal another object's new hash after sanitization.
    for relative, data in materialized.items():
        target = ROOT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    for manifest_path, manifest in updated_manifests:
        save(manifest_path, manifest)
    # Only now remove obsolete objects in this generated history object store.
    for path in (ROOT / 'objects').rglob('*'):
        if path.is_file() and path.relative_to(ROOT).as_posix() not in keep:
            path.unlink()
    index = load(ROOT / 'index.json')
    index['publicationStatus'] = 'sanitization-reviewed-hashes-finalized'
    index['objectCount'] = len(keep)
    index['objectBytes'] = sum((ROOT / p).stat().st_size for p in keep)
    save(ROOT / 'index.json', index)
    print(json.dumps({'manifests': len(manifests()), 'entries': total, 'objects': len(keep)}, ensure_ascii=False))

def verify():
    checked = {}
    total = 0
    for path in manifests():
        manifest = load(path)
        if manifest.get('publicationStatus') != 'sanitization-reviewed-hashes-finalized':
            raise RuntimeError('History sanitization/finalize is pending')
        seen = set()
        for entry in manifest['entries']:
            relative = str(safe_relative(entry['path']))
            if relative in seen:
                raise RuntimeError('Duplicate restored path')
            seen.add(relative)
            obj = str(safe_relative(entry['object']))
            if obj not in checked:
                data = (ROOT / obj).read_bytes()
                checked[obj] = (digest(data), len(data))
            if checked[obj] != (entry['sha256'], entry['bytes']):
                raise RuntimeError('Object hash or size mismatch')
            total += 1
    print(json.dumps({'verifiedPackages': len(manifests()), 'verifiedEntries': total, 'verifiedObjects': len(checked)}, ensure_ascii=False))

def restore(package, output):
    key = safe_relative(package)
    if len(key.parts) != 1:
        raise ValueError('Package must be one identifier from index.json')
    manifest = load(ROOT / 'packages' / str(key) / 'manifest.json')
    if manifest.get('publicationStatus') != 'sanitization-reviewed-hashes-finalized':
        raise RuntimeError('History sanitization/finalize is pending')
    target = Path(output).expanduser().absolute()
    # Reject every pre-existing symlink ancestor and all existing output paths.
    for ancestor in [target, *target.parents]:
        if ancestor.is_symlink():
            raise ValueError('Output must not include symlink ancestors')
    if target.exists():
        raise FileExistsError('Output already exists; choose a new directory')
    for entry in manifest['entries']:
        data = (ROOT / safe_relative(entry['object'])).read_bytes()
        if digest(data) != entry['sha256']:
            raise RuntimeError('Object hash mismatch')
    target.mkdir(parents=True)
    for entry in manifest['entries']:
        dest = target / safe_relative(entry['path'])
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / entry['object'], dest)
        dest.chmod(0o755 if entry.get('executable') else 0o644)
    save(target / 'PUBLICATION-MANIFEST.json', manifest)
    print(json.dumps({'package': package, 'restoredFiles': len(manifest['entries']), 'output': str(target)}, ensure_ascii=False))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('finalize')
    p.add_argument('--sanitization-reviewed', action='store_true')
    sub.add_parser('verify')
    p = sub.add_parser('restore')
    p.add_argument('--package', required=True)
    p.add_argument('--output', required=True)
    args = parser.parse_args()
    if args.command == 'finalize':
        finalize(args.sanitization_reviewed)
    elif args.command == 'verify':
        verify()
    else:
        restore(args.package, args.output)

if __name__ == '__main__':
    main()
