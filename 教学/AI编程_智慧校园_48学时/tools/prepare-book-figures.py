"""Freeze author inputs, extract figure metadata, and insert rendered figures.

Run with no arguments before figure rendering; run --insert only after all PNGs exist.
Never changes contracts, course index or source design chapters.
"""
from pathlib import Path
from datetime import datetime
import argparse
import hashlib
import json
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / 'illustrations/chapter-figures.json'
CAPTION = re.compile(r'\*\*图\s*(\d{2}-\d{2})\s+(.+?)\*\*[^\S\n]*(?:\n)?(.*?)(?=\n\s*\n|\Z)', re.S)

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def dump(p, data):
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def prepare():
    baseline = ROOT / 'tools/.cache' / ('phase2-baseline-' + datetime.now().strftime('%Y%m%dT%H%M%S'))
    inputs = sorted((ROOT / 'manuscript').glob('*.md')) + sorted((ROOT / 'figure-sources').glob('ch*'))
    baseline.mkdir(parents=True, exist_ok=False)
    manifest = []
    for p in inputs:
        relative = p.relative_to(ROOT)
        dest = baseline / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dest)
        manifest.append({'file': str(relative), 'sha256': digest(p)})
    dump(baseline / 'manifest.json', manifest)
    figures = []
    for doc in sorted((ROOT / 'manuscript').glob('*.md')):
        for match in CAPTION.finditer(doc.read_text()):
            number, title, rest = match.groups()
            title = title.strip().rstrip('。')
            source = re.search(r'\]\(\.\./(figure-sources/[^)]+)\)', rest)
            alt = re.search(r'替代文字：(.*)', rest)
            if not source or not alt:
                raise ValueError(f'{number}: 无法提取图源或替代文字')
            source_file = ROOT / source.group(1)
            if not source_file.is_file() or not source_file.stem.startswith('ch' + number):
                raise ValueError(f'{number}: 图源不存在或编号不一致')
            alt_text = alt.group(1).strip()
            explanation = rest[source.end():].split('替代文字：')[0].strip().lstrip('。').strip()
            if not explanation:
                explanation = alt_text
            label = '教学界面示意，非运行截图' if number == '06-01' else '教学示意，非运行证据'
            meta = {'id': '图 ' + number, 'title': title, 'alt': alt_text,
                    'caption': f'图 {number}　{title}。{label}。',
                    'evidenceKind': 'TEACHING_UI_SCHEMATIC' if number == '06-01' else 'TEACHING_SCHEMATIC',
                    'labVerified': False}
            dump(source_file.with_suffix('.figure.json'), meta)
            figures.append({**meta, 'number': number, 'chapter': number[:2],
                            'source': source.group(1), 'stem': source_file.stem,
                            'png': 'illustrations/' + source_file.stem + '.png',
                            'svg': 'illustrations/' + source_file.stem + '.svg',
                            'manuscript': str(doc.relative_to(ROOT)),
                            'explanation': explanation, 'authorCaption': match.group(0)})
    source_names = {p.stem for p in (ROOT / 'figure-sources').glob('ch*') if p.suffix in {'.mmd', '.svg'}}
    if len(figures) != 38 or len({f['number'] for f in figures}) != 38 or source_names != {f['stem'] for f in figures}:
        raise ValueError('章节图源与正文图注数量或映射不一致')
    dump(INDEX, {'schemaVersion': 1, 'baseline': str(baseline.relative_to(ROOT)), 'labVerified': False, 'figures': figures})
    print(f'已冻结 {len(inputs)} 份作者输入，提取 {len(figures)} 幅图元信息。')

def insert():
    data = json.loads(INDEX.read_text())
    for f in data['figures']:
        if not (ROOT / f['png']).is_file() or not (ROOT / f['svg']).is_file():
            raise ValueError(f"尚未渲染 {f['number']}")
    for doc in sorted((ROOT / 'manuscript').glob('*.md')):
        text = doc.read_text()
        items = [f for f in data['figures'] if f['manuscript'] == str(doc.relative_to(ROOT))]
        for f in items:
            source = ROOT / f['source']
            # Remove display Mermaid only when it belongs to this figure's caption.
            original = f['authorCaption']
            if original not in text:
                if f"../{f['png']}" in text:
                    continue
                raise ValueError(f"找不到作者图注 {f['number']}")
            before, after = text.split(original, 1)
            blocks = list(re.finditer(r'^```mermaid[^\n]*\n[\s\S]*?^```[ \t]*$', before, re.M))
            if blocks and not before[blocks[-1].end():].strip():
                before = before[:blocks[-1].start()]
            if source.suffix == '.svg':
                before = re.sub(r'!\[[^\]]*\]\(\.\./' + re.escape(f['source']) + r'(?:\s+"[^"]*")?\)\s*$', '', before)
            escaped_alt = f['alt'].replace('[', '\\[').replace(']', '\\]')
            block = (f"![{escaped_alt}](../{f['png']})\n\n"
                     f"*{f['caption']}*\n\n{f['explanation']}\n\n"
                     f"[可编辑图源：{source.name}](../{f['source']})")
            text = before.rstrip() + '\n\n' + block + after
        text = re.sub(r'^# 第\s*(\d{2})\s*章\s*', lambda m: f'# 第 {m[1]} 章 ', text, flags=re.M)
        if '```mermaid' in text:
            raise ValueError(f'{doc.name}: 尚有 Mermaid 显示代码块')
        doc.write_text(text)
    print('已插入 38 幅 PNG；保留解释与可编辑图源链接。')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--insert', action='store_true')
    args = parser.parse_args()
    insert() if args.insert else prepare()
