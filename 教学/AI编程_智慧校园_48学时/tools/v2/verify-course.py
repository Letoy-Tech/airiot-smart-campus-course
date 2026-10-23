"""Check course structure and generated links, without claiming a browser or student trial."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import ast
import json
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
BOOK = ROOT / "handbook-v2"
CONFIG = json.loads((ROOT / "tools/v2/course-config.json").read_text())
VERSION = CONFIG["version"]
REPORT = BOOK / f"author/evidence/v{VERSION}-static-results.json"
ENGINEERING = BOOK / "engineering"


def without_code(markdown):
    """Ignore examples when checking prose links; accept backtick and tilde fences."""
    lines = []
    fence = None
    for line in markdown.splitlines():
        match = re.match(r"^\s{0,3}(`{3,}|~{3,})", line)
        if match:
            mark = match[1]
            if fence is None:
                fence = mark
            elif mark[0] == fence[0] and len(mark) >= len(fence):
                fence = None
            continue
        if fence is None:
            lines.append(line)
    return re.sub(r"(`+).*?\1", "", "\n".join(lines))


def check_markdown_links(files):
    """Check local destinations, not remote availability or Markdown heading slugs."""
    checked = 0
    for source in files:
        text = without_code(source.read_text())
        # Current course uses inline/image links. Include reference definitions too.
        links = re.findall(r"!?\[[^\]\n]*\]\((<[^>]+>|[^)\n]+)\)", text)
        links += re.findall(r"^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)", text, re.M)
        for raw in links:
            raw = raw.strip()
            if raw.startswith("<"):
                link = raw[1:raw.index(">")]
            else:
                link = re.split(r'\s+[\"\']', raw, maxsplit=1)[0]
            parsed = urlsplit(link)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue  # External link or page-local anchor; no network requests.
            target = source.parent / unquote(parsed.path)
            # This run writes its own evidence before building the reader. A new
            # version must not need a fabricated placeholder report to pass.
            if target.resolve() != REPORT.resolve():
                assert target.exists(), (str(source.relative_to(ROOT)), "missing-markdown-link", link)
            checked += 1
    return checked


def check_time_table(lesson, text, steps, minutes):
    header = ["步骤", "工程训练（分钟）", "编码与验证（分钟）", "合计（分钟）"]
    lines = text.splitlines()
    matches = [i for i, line in enumerate(lines) if line.strip().startswith("|")
               and [cell.strip() for cell in line.strip().strip("|").split("|")] == header]
    assert len(matches) == 1, (lesson.name, "canonical-time-table")
    start = matches[0]
    separator = [cell.strip() for cell in lines[start + 1].strip().strip("|").split("|")]
    assert len(separator) == 4 and all(re.fullmatch(r":?-+:?", x) for x in separator), lesson.name
    rows = []
    for line in lines[start + 2:]:
        if not line.strip().startswith("|"):
            break
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        assert len(cells) == 4 and all(re.fullmatch(r"\d+", x) for x in cells[1:]), (lesson.name, cells)
        rows.append((cells[0], *map(int, cells[1:])))
    assert len(rows) == len(steps) + 1 and rows[-1][0] == "合计", (lesson.name, "time-table-row-count")
    training, coding = [], []
    for index, (row, step, expected) in enumerate(zip(rows[:-1], steps, minutes), 1):
        number, engineering, practice, total = row
        assert number == str(index), (lesson.name, "time-table-step-order", number)
        assert engineering > 0 and practice > 0 and engineering + practice == total == expected, (lesson.name, index, row, expected)
        card = re.findall(r"\*\*本步时间：\*\*\s*(\d+)分钟\s*=\s*工程训练(\d+)分钟\s*\+\s*编码/操作(\d+)分钟", step)
        assert len(card) == 1 and tuple(map(int, card[0])) == (total, engineering, practice), (lesson.name, index, "step-time-card")
        for label in ["先想", "亲手做", "解释", "证据"]:
            assert re.search(r"\*\*" + label + r"：\*\*\s*\S", step), (lesson.name, index, "engineering-activity", label)
        training.append(engineering)
        coding.append(practice)
    assert rows[-1][1:] == (sum(training), sum(coding), 180), (lesson.name, "time-table-totals")
    summary = re.findall(r"\*\*本课工程训练：\*\*\s*(\d+)分钟[^\n]*编码与运行操作共(\d+)分钟", text)
    assert len(summary) == 1 and tuple(map(int, summary[0])) == (sum(training), sum(coding)), (lesson.name, "lesson-time-summary")
    return training, coding


def check_engineering():
    names = CONFIG["engineering_documents"]
    assert len(names) == len(set(names)) == 8, "eight-engineering-documents"
    documents = [ENGINEERING / name for name in names]
    assert {p.name for p in ENGINEERING.glob("[0-9][0-9]-*.md")} == set(names)
    for document in documents:
        assert document.is_file() and document.read_text().strip(), document
        assert document.read_text().count("```") % 2 == 0, document.name
    figures = {"use-cases.svg", "architecture-deployment.svg", "er-model.svg", "event-state.svg",
               "login-sequence.svg", "event-sequence.svg", "concept-classes.svg"}
    assert {p.name for p in (ENGINEERING / "figures").glob("*.svg")} == figures
    all_text = "\n".join(p.read_text() for p in documents)
    for name in sorted(figures):
        svg = ET.parse(ENGINEERING / "figures" / name).getroot()
        assert svg.tag == "{http://www.w3.org/2000/svg}svg", name
        assert svg.find("{http://www.w3.org/2000/svg}title") is not None, (name, "accessible-title")
        assert "figures/" + name in all_text, (name, "unreferenced-figure")
        for element in svg.iter():
            assert element.tag.split("}")[-1] != "script", (name, "svg-script")
            for attribute, value in element.attrib.items():
                if attribute.split("}")[-1] in {"href", "src"}:
                    assert value.startswith(("#", "data:")), (name, "nonembedded-svg-resource", value)
    spec = json.loads((ENGINEERING / "openapi.json").read_text())
    assert spec["openapi"] == "3.1.0" and spec["info"]["version"] == VERSION
    assert len(spec["paths"]) == 14, "openapi-path-count"
    reference_count = 0

    def resolve(pointer):
        assert pointer.startswith("#/"), ("nonlocal-openapi-ref", pointer)
        value = spec
        for token in pointer[2:].split("/"):
            key = unquote(token).replace("~1", "/").replace("~0", "~")
            value = value[int(key)] if isinstance(value, list) else value[key]
        return value

    def references(value):
        nonlocal reference_count
        if isinstance(value, dict):
            for key, child in value.items():
                if key == "$ref":
                    resolve(child)
                    reference_count += 1
                else:
                    references(child)
        elif isinstance(value, list):
            for child in value:
                references(child)

    references(spec)
    operations, operation_ids = set(), []
    for path, item in spec["paths"].items():
        for method, operation in item.items():
            if method not in {"get", "post", "put", "patch", "delete", "head", "options", "trace"}:
                continue
            operations.add((method.upper(), "/api" + path))
            operation_ids.append(operation["operationId"])
            parameters = item.get("parameters", []) + operation.get("parameters", [])
            parameters = [resolve(p["$ref"]) if "$ref" in p else p for p in parameters]
            path_parameters = {p["name"] for p in parameters if p.get("in") == "path" and p.get("required") is True}
            assert path_parameters == set(re.findall(r"\{([^}]+)\}", path)), (path, "path-parameters")
            security = operation.get("security", spec.get("security", []))
            if (method, path) in {("get", "/health"), ("post", "/login")}:
                assert security == [], (path, "public-endpoint")
            else:
                assert security, (path, "protected-endpoint")
                for requirement in security:
                    assert requirement and set(requirement) <= set(spec["components"]["securitySchemes"])
    assert len(operations) == len(operation_ids) == len(set(operation_ids)) == 15, "openapi-operation-count"
    controller = ROOT / "resources/from-zero-v2/teacher-reference/backend/src/main/java/cn/campus/course/CampusController.java"
    source_operations = {(method.upper(), "/api" + path) for method, path in
                         re.findall(r'@(Get|Post|Put|Patch|Delete)Mapping\(\s*"([^"]+)"\s*\)', controller.read_text())}
    assert operations == source_operations, ("openapi-controller-mismatch", operations ^ source_operations)
    return {"documents": names, "figures": sorted(figures), "openapi_paths": 14,
            "openapi_operations": 15, "openapi_internal_refs": reference_count,
            "openapi_matches_reference_controller": True}


def check_contract_boundaries(text):
    """Guard the teaching rules that previously disappeared from AI input cards."""
    requirements = {
        "assign": ["仅ADMIN", "username=manager", "非空", "NEW或ASSIGNED", "IN_PROGRESS不可重新分派"],
        "start": ["ADMIN或本事件的manager", "要求ASSIGNED", "IN_PROGRESS"],
        "note": ["ADMIN或本事件的manager", "IN_PROGRESS", "非空", "verified=false"],
        "recover": ["仅ADMIN", "IN_PROGRESS", "RECOVERED", "verified=false", "重复recover"],
        "verify": ["ADMIN或本事件的manager", "IN_PROGRESS", "非空", "RECOVERED", "verified=true"],
        "close": ["ADMIN或本事件的manager", "IN_PROGRESS", "非空", "RECOVERED", "verified=true", "conclusion", "CLOSED"],
    }
    for action, required in requirements.items():
        lines = re.findall(r"^- " + action + r"：(.+)$", text, re.M)
        assert len(lines) == 1 and all(token in lines[0] for token in required), ("contract-action-rule", action)
    for statement in ["核实后改写note或再次recover必须重新verify才能close", "拒绝不增加版本",
                      "新建事件与空间说明编辑不带expectedVersion", "首次登记提交expectedVersion=0"]:
        assert statement in text, ("contract-boundary", statement)
    return sorted(requirements)


def check_public_templates(starter, reference):
    expected = {"需求与用例记录.md", "模型说明记录.md", "API核对记录.md", "测试记录.md", "交接与个人证据.md", "同伴评审记录.md"}
    for name in expected:
        path = ENGINEERING / "templates" / name
        assert path.is_file() and path.read_text().strip(), ("missing-engineering-template", name)
    required = {"DB_PASSWORD", "MYSQL_ROOT_PASSWORD", "REDIS_PASSWORD", "DEMO_PASSWORD"}
    for directory in (starter, reference):
        path = directory / ".env.example"
        assert path.is_file(), (directory.name, "missing-public-env-template")
        values = dict(re.findall(r"^([A-Z_]+)=([^\n]*)$", path.read_text(), re.M))
        assert required <= set(values), (directory.name, "missing-env-template-key")
        assert all(values[key] == "GENERATED_LOCALLY" for key in required), (directory.name, "non-placeholder-env-template")
    return sorted(expected)


def offline_node_report(name):
    """Run isolated behavioral checks, never the browser or shared runtime."""
    result = subprocess.run(["node", str(ROOT / "tools/v2" / name)], check=True,
                            capture_output=True, text=True, timeout=30)
    return json.loads(result.stdout)


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
    training, coding = check_time_table(lesson, text, steps, minutes)
    detail.append({"lesson": lesson.name, "steps": len(steps), "minutes": minutes,
                   "engineering_minutes": training, "coding_and_verification_minutes": coding})
assert sum(x["steps"] for x in detail) == 64
assert len(lessons) == CONFIG["lessons"] and sum(x["steps"] for x in detail) == CONFIG["steps"]
assert len(lessons) * 180 == CONFIG["total_class_hours"] * CONFIG["minutes_per_class_hour"]

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
contract_actions = check_contract_boundaries(contracts[0].read_text())
templates = check_public_templates(starter, reference)
data_service_regression = offline_node_report("verify-data-service.mjs")
mock_regression = offline_node_report("verify-mock.mjs")
fixture = json.loads(fixtures[0].read_text())
assert [len(fixture[x]) for x in ["spaces", "devices", "points"]] == [4, 16, 28]
helper_files = ["check-environment.mjs", "native-runtime.py"]
for name in helper_files:
    copies = [ROOT / "tools/v2" / name, starter / "materials" / name, reference / "materials" / name]
    assert all(p.is_file() for p in copies) and len({p.read_bytes() for p in copies}) == 1, (name, "helper-copies-differ")
    if name.endswith(".py"):
        ast.parse(copies[0].read_text(), filename=name)
engineering = check_engineering()
markdown = set(ROOT.glob("*.md")) | set(BOOK.rglob("*.md")) | set(starter.rglob("*.md")) | set(reference.rglob("*.md"))
markdown_links = check_markdown_links(sorted(markdown))
report = {
    "version": VERSION,
    "lessons": detail,
    "steps": 64,
    "starter_empty": True,
    "fixtures_and_contract_bodies_identical": True,
    "contract_action_boundaries_checked": contract_actions,
    "engineering_templates_checked": templates,
    "public_env_templates_checked": ["student-start/.env.example", "teacher-reference/.env.example"],
    "data_service_offline_regression": data_service_regression,
    "mock_offline_regression": mock_regression,
    "per_step_engineering_activities_and_time_tables_checked": True,
    "engineering": engineering,
    "environment_helper_copies_identical": helper_files,
    "markdown_files_checked": len(markdown),
    "markdown_local_destinations_checked": markdown_links,
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
        for attribute in ("href", "src"):
            if attribute in attrs:
                self.links.append(attrs[attribute])

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
print("PASS: 12 lessons, 64 engineering/time allocations, 12 x 180 minutes, 8 engineering documents, 7 offline SVGs, "
      "OpenAPI 14 paths/15 operations, helper copies, Markdown destinations, starter, fixtures/contracts, templates, "
      "offline request/mock regressions, reader links and specific-step navigation.")
