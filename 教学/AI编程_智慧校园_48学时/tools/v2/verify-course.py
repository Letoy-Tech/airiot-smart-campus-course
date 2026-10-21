"""Check course structure and generated links, without claiming a browser or student trial."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote
import json
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
BOOK = ROOT / "handbook-v2"
VERSION = "2.0.2"
REPORT = BOOK / f"author/evidence/v{VERSION}-static-results.json"
lessons = sorted((BOOK / "lessons").glob("[0-9][0-9]-*.md"))
assert len(lessons) == 12
detail = []
for lesson in lessons:
    text = lesson.read_text()
    assert text.count("```") % 2 == 0, lesson.name
    steps = re.split(r"^## 第\s*\d+\s*步[^\n]*\n", text, flags=re.M)[1:]
    for index, step in enumerate(steps, 1):
        patterns = {
            "location": r"\*\*现在在哪",
            "prompt": r"```(?:prompt|text)",
            "wait": r"\*\*(?:等到什么|等 AI 完成并保存)",
            "student_action": r"\*\*(?:自己|亲自操作)",
            "expected": r"\*\*应该(?:看到|看见)",
            "repair": r"(?:\*\*如果|修复提示)",
            "next": r"(?:进入第|下一|下课|完成本课|本课完成|这节课|交给老师)",
        }
        for name, pattern in patterns.items():
            assert re.search(pattern, step), (lesson.name, index, name)
    allocation = re.search(r"建议用时(?:依次为\s*|：)([\d、\s]+)分钟", text)
    assert allocation, lesson.name
    minutes = [int(x) for x in re.findall(r"\d+", allocation[1])]
    assert len(minutes) == len(steps) and sum(minutes) == 180, lesson.name
    detail.append({"lesson": lesson.name, "steps": len(steps), "minutes": minutes})
assert sum(x["steps"] for x in detail) == 64

starter = ROOT / "resources/from-zero-v2/student-start"
reference = ROOT / "resources/from-zero-v2/teacher-reference"
assert (starter / "frontend/index.html").stat().st_size == 0
assert not (starter / "backend/src").exists()
assert not (starter / "frontend/app.js").exists()
fixtures = [
    starter / "materials/mock-campus.json",
    reference / "materials/mock-campus.json",
    reference / "backend/src/main/resources/data/mock-campus.json",
]
assert len({p.read_bytes() for p in fixtures}) == 1
contracts = [
    BOOK / "author/共享约定.md",
    starter / "materials/约定卡.md",
    reference / "materials/约定卡.md",
]
assert len({p.read_text().split("## 主线", 1)[1] for p in contracts}) == 1
fixture = json.loads(fixtures[0].read_text())
assert [len(fixture[x]) for x in ["spaces", "devices", "points"]] == [4, 16, 28]
report = {
    "version": VERSION,
    "lessons": detail,
    "steps": 64,
    "starter_empty": True,
    "fixtures_and_contract_bodies_identical": True,
    "reader_static_checked": False,
    "reader_visual_review_in_this_check": False,
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
builder = ROOT / "tools/v2/build-reader.mjs"
subprocess.run(["node", str(builder)], check=True)

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.links = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if "href" in attrs:
            self.links.append(attrs["href"])

for name in ["index.html", f"从空白开始_手把手教程_V{VERSION}.html"]:
    parser = Links()
    parser.feed((BOOK / name).read_text())
    assert len(parser.ids) == len(set(parser.ids))
    for link in parser.links:
        if link.startswith("#"):
            assert link[1:] in parser.ids, link
        elif not re.match(r"^(https?://|mailto:|data:)", link):
            assert name == "index.html", ("standalone-local-link", link)
            assert (BOOK / unquote(link.split("#")[0])).exists(), link
    # The lesson 08 cross-reference must reach the Java step, not the chapter top.
    assert 'href="#chapter-7-step-2">第07课第2步</a>' in (BOOK / name).read_text()
    report["reader_unique_ids"] = len(parser.ids)

report["reader_static_checked"] = True
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
subprocess.run(["node", str(builder)], check=True)  # Embed the completed evidence.
shutil.copyfile(ROOT / "course-index-v2.json", ROOT / "course-index.json")
print("PASS: 12 lessons, 64 steps, 12 x 180 minutes, starter, shared fixtures/contracts, reader links and specific-step navigation.")
