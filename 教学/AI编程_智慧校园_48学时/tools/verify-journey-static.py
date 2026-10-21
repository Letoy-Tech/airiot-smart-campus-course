#!/usr/bin/env python3
"""Read-only source/link/manifest audit. Writes only its two audit reports.

This deliberately does not run Node, npm, Maven, HTTP, a browser, an AI session,
or a database. PASS_STATIC is not proof of any of those execution layers.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit


FORBIDDEN = {".private", ".git", "node_modules", ".runtime", "target", "dist"}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class Page(HTMLParser):
    def __init__(self, text: str):
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.links: list[tuple[str, str, int]] = []
        self.stations: dict[str, list[str]] = {}
        self.current: str | None = None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        if tag == "a" and attrs.get("name"):
            self.ids.append(attrs["name"])
        for key in ("href", "src"):
            if key in attrs:
                self.links.append((key, attrs[key], self.getpos()[0]))
        if tag == "article" and attrs.get("data-station"):
            self.current = attrs["data-station"]
            self.stations[self.current] = []

    def handle_endtag(self, tag):
        if tag == "article":
            self.current = None

    def handle_data(self, data):
        if self.current:
            self.stations[self.current].append(data)


class Audit:
    def __init__(self, root: Path, output_dir=None):
        self.root = root.resolve()
        self.output_dir = Path(output_dir).resolve() if output_dir else self.root / "journey/qa/round10"
        self.bound: dict[str, dict] = {}
        self.findings: list[dict] = []
        self.counts = Counter()
        self.criteria: list[str] = []

    def issue(self, code, path, message, remedy, line=None):
        self.findings.append({"severity": "error", "code": code,
                              "path": str(path), "line": line,
                              "message": message, "remedy": remedy})

    def file(self, path: str | Path) -> Path:
        p = path if isinstance(path, Path) else self.root / path
        if not p.is_absolute():
            p = self.root / p
        p = p.resolve()
        if not p.is_relative_to(self.root) or FORBIDDEN.intersection(p.relative_to(self.root).parts):
            raise ValueError(f"refuse out-of-scope/private path: {path}")
        return p

    def read(self, path: str | Path) -> bytes:
        p = self.file(path)
        data = p.read_bytes()
        self.bound[p.relative_to(self.root).as_posix()] = {"sha256": sha(data), "bytes": len(data)}
        return data

    def text(self, path: str | Path) -> str:
        return self.read(path).decode("utf-8-sig")

    def json(self, path: str | Path):
        return json.loads(self.text(path))

    def check(self, condition, code, path, message, remedy, line=None):
        self.counts["assertions"] += 1
        if not condition:
            self.issue(code, path, message, remedy, line)

    def safe_relative(self, value) -> bool:
        return (isinstance(value, str) and bool(value) and "\\" not in value
                and not PurePosixPath(value).is_absolute()
                and not any(x in ("", ".", "..") or x in FORBIDDEN for x in value.split("/")))

    def record(self, base: Path, item: dict, owner: str):
        rel = item.get("path")
        if not self.safe_relative(rel):
            self.issue("UNSAFE_MANIFEST_PATH", owner, f"非法路径 {rel!r}", "修正清单，不读取秘密或越界文件。")
            return
        p = base / rel
        if not p.is_file():
            self.issue("MISSING_MANIFEST_FILE", owner, f"缺少 {rel}", "重新生成相应阶段/清单。")
            return
        data = self.read(p)
        self.check(sha(data) == item.get("sha256"), "MANIFEST_HASH", owner,
                   f"哈希不符：{rel}", "先修源文件，再重建清单；不要手填通过。")
        if "bytes" in item:
            self.check(len(data) == item["bytes"], "MANIFEST_BYTES", owner,
                       f"字节数不符：{rel}", "重新生成清单。")
        self.counts["manifestFileReferences"] += 1

    def html(self):
        path = "journey/index.html"
        page = Page(self.text(path))
        self.check(not [k for k, v in Counter(page.ids).items() if v > 1], "DUPLICATE_ID", path,
                   "HTML 存在重复 id。", "为标题和复制块生成唯一 id。")
        self.counts["htmlIds"] = len(page.ids)
        self.check(set(page.stations) == {f"{n:02}" for n in range(1, 13)}, "STATIONS", path,
                   "应有 01—12 的独立站点。", "核对 lessons.json 与生成器。")
        cache = {self.root / path: set(page.ids)}
        pages = [(path, page)]
        for entry in ("index.html", "先打开这里.html"):
            pages.append((entry, Page(self.text(entry))))
        for source_path, source_page in pages:
            self.check_links(source_path, source_page, cache)
        self.check(self.read("index.html") == self.read("先打开这里.html"), "ROOT_ENTRY_DRIFT", "index.html",
                   "两个根入口内容不同。", "从同一生成器重建入口。")
        self.counts["htmlPages"] = len(pages)
        for n, parts in page.stations.items():
            content = "\n".join(parts)
            for command in (f"node tools/progress.mjs plan {n}", f"node tools/progress.mjs begin {n}",
                            "node tools/progress.mjs verify"):
                self.check(command in content, "STATION_COMMAND", path, f"第 {n} 站缺 {command}",
                           "在该站显示实际入口命令，包括没有新增业务页的第 11/12 站。")
        self.criteria.append("两个根入口及 journey HTML 本地 href/src、唯一 id、锚点与 12 站 plan/begin/verify；不访问外链。")
        return page

    def check_links(self, path, page, cache):
        for kind, raw, line in page.links:
            self.counts["htmlLinks"] += 1
            url = urlsplit(raw)
            if url.scheme or url.netloc:
                self.check(url.scheme != "file", "FILE_SCHEME", path, f"含绝对 file URL：{raw}",
                           "改为包内相对链接。", line)
                self.counts["externalLinksNotFetched"] += 1
                continue
            target = ((self.root / path).parent / unquote(url.path)).resolve() if url.path else self.root / path
            try:
                target = self.file(target)
            except ValueError:
                self.issue("LINK_OUTSIDE_PACKAGE", path, f"链接越界：{raw}", "使用包内相对链接。", line)
                continue
            self.check(target.is_file(), "BROKEN_LOCAL_LINK", path, f"目标不存在：{raw}",
                       "补齐目标文件或修正链接。", line)
            if not target.is_file():
                continue
            self.counts["localLinks"] += 1
            self.read(target)
            if url.fragment and target.suffix.lower() in (".html", ".htm", ".svg"):
                if target not in cache:
                    cache[target] = set(Page(self.text(target)).ids)
                self.check(unquote(url.fragment) in cache[target], "BROKEN_ANCHOR", path,
                           f"锚点不存在：{raw}", "修正 href 或目标 id。", line)
                self.counts["anchors"] += 1

    def manuscripts(self, lessons):
        self.check([s.get("id") for s in lessons] == [f"{n:02}" for n in range(1, 13)],
                   "LESSON_ORDER", "journey/lessons.json", "站号不是连续 01—12。", "恢复连续站号。")
        for lesson in lessons:
            path = f"journey/{lesson['id']}-{lesson['title']}.md"
            text = self.text(path)
            self.counts["stationMarkdown"] += 1
            self.check(len(re.findall(r"^```", text, re.M)) % 2 == 0, "FENCE", path,
                       "Markdown 代码围栏不成对。", "补齐代码围栏。")
            requirements = {
                "operation": bool(re.search(r"^\d+\. .*(?:运行|打开|选择|点击|创建|备份|停止|触发|切换|分派|按|把|在|用)", text, re.M)),
                "prompt": bool(re.search(r"```prompt\s*\n[\s\S]{40,}?\n```", text)),
                "expected": "过关结果：" in text and "- [ ]" in text,
                "failure": "## 卡住时" in text and "第一条错误" in text,
            }
            for key, present in requirements.items():
                self.check(present, "MISSING_TEACHING_ELEMENT", path, f"缺少可识别的 {key} 要素。",
                           "补具体操作、可复制提示、预期结果或失败处理；关键词通过仍须人工审读内容。")
            self.check("CodeBuddy" in text, "OLD_IDE", path, "没有明确 CodeBuddy 操作上下文。",
                       "沿用 CodeBuddy 独立 IDE，避免跳回旧网页 AI 工作流。")
        for path in ("journey/00-怎么开始.md", "journey/功能验收.md", "journey/教师安排.md"):
            self.text(path)
        acceptance = self.text("journey/功能验收.md")
        for boundary in ("通用用户", "没有", "AIRIOT", "选做", "未", "Windows"):
            self.check(boundary in acceptance, "SCOPE_BOUNDARY", "journey/功能验收.md",
                       f"缺少范围/证据边界：{boundary}", "明确校园业务、通用后台缺口及未实测范围。")
        combined = "\n".join(self.text(f"journey/{x['id']}-{x['title']}.md") for x in lessons)
        prompts = json.dumps(lessons, ensure_ascii=False) + combined
        self.check("canManageLocations" not in prompts, "CAPABILITY_DRIFT", "journey/lessons.json",
                   "仍引用不存在的 canManageLocations。", "实际入口使用 canAdmin === true。")
        self.check("ensureClosable" not in prompts, "METHOD_DRIFT", "journey/lessons.json",
                   "仍引用不存在的 ensureClosable。", "实际服务方法为 requireClosable。")
        for n, required in ((7, ("AccessView", "strictCapability")),
                            (9, ("CloseChecklist", "AlarmDetail", "closeBlockers"))):
            for token in required:
                self.check(token in lessons[n - 1]["prompt"], "TARGET_PROMPT", "journey/lessons.json",
                           f"第 {n:02} 站提示缺目标依赖 {token}。", "将提示直接指向待实现组件及其真实合同。")
        self.criteria.append("12 篇正文各有具体动作、prompt、预期和失败分支；已复核第 04/07/09 站既有合同修复及完成范围。")

    def manifests(self):
        base = self.root / "resources/project-journey"
        index_path = "resources/project-journey/BUILD-MANIFEST.json"
        index = self.json(index_path)
        self.check(not index.get("pending"), "PENDING_REFERENCE", index_path, "生成清单仍有待补文件。", "先补齐参考后重新生成。")
        self.check(len(index.get("stages", [])) == 12, "STAGE_COUNT", index_path, "清单不是 12 站。", "重建完整阶段。")
        for record in index["files"]:
            self.record(base, record, index_path)
        for record in index.get("sourceFiles", []):
            self.record(self.root / index["source"], record, index_path)
        cumulative = set()
        for n in range(1, 13):
            path = f"resources/project-journey/app/lesson-bundles/stage-{n:02}/manifest.json"
            manifest = self.json(path)
            self.check(manifest.get("schema") == 1 and manifest.get("stage") == n,
                       "STAGE_SCHEMA", path, "阶段 schema/编号不符。", "重新生成。")
            files = manifest["files"]
            names = [x["path"] for x in files]
            self.check(len(names) == len(set(names)), "DUPLICATE_STAGE_FILE", path, "阶段文件重复。", "去除重复定义。")
            business = {x["path"] for x in files if x.get("role") == "business"}
            self.check(business == set(manifest.get("businessFiles", [])), "BUSINESS_FILES", path,
                       "业务目标与文件角色不符。", "同步阶段目标与 files.role。")
            for item in files:
                self.record((self.root / path).parent / "files", item, path)
                self.check(item.get("role") in {"business", "assembly", "foundation"}, "FILE_ROLE", path,
                           f"未知角色：{item['path']}", "明确学生业务、装配或公共基础。")
                if item.get("role") == "business" and n != 1:
                    self.check(isinstance(item.get("stub"), str) and "JOURNEY_IMPLEMENTATION_REQUIRED" in item["stub"],
                               "BUSINESS_STUB", path, f"业务文件无明确未完成骨架：{item['path']}", "补可识别的骨架，勿将参考导入称为学生实现。")
                if item.get("role") == "business":
                    self.read(base / "reference" / item["path"])
            cumulative.update(names)
            for context in manifest.get("contextFiles", []):
                self.check(context in cumulative, "MISSING_CONTEXT", path,
                           f"到本阶段还不存在上下文文件：{context}", "提前装配依赖，或修正 AI 引用路径。")
            self.check(not manifest.get("pendingReference"), "PENDING_REFERENCE", path,
                       "阶段有待补参考。", "补齐后重建。")
            self.counts["stageManifests"] += 1
            self.counts["businessTargets"] += len(business)
        expected_integration = {6: {"frontend/src/views/DeviceCatalog.vue", "frontend/src/views/EnergyView.vue"}, 9: {"frontend/src/views/CasesView.vue"}}
        for n, expected in expected_integration.items():
            path = f"resources/project-journey/app/lesson-bundles/stage-{n:02}/manifest.json"
            manifest = self.json(path)
            self.check(set(manifest.get("integrationFiles", [])) == expected, "INTEGRATION_TARGETS", path,
                       "跨站继续修改目标缺失", "同步lesson元数据与生成器；不自动覆盖旧页面。")
            self.check(expected.isdisjoint({x["path"] for x in manifest["files"]}), "INTEGRATION_OVERWRITE", path,
                       "跨站目标不应作为新增导入覆盖", "只在integrationFiles声明，保留前章个人实现。")
        for record in index.get("authoringSources", []):
            self.record(self.root, record, index_path)
        self.criteria.append("总清单与 12 个阶段：引用存在、SHA-256/bytes、角色、骨架、累计上下文文件；不实际导入阶段。")

    def commands(self, page):
        path = "resources/project-journey/app/tools/progress.mjs"
        text = self.text(path)
        authoring = self.text("resources/project-journey/authoring/progress.mjs")
        self.check(text == authoring, "PROGRESS_SOURCE_DRIFT", path, "运行入口与 authoring 源不同。", "重建阶段工程。")
        for action in ("plan", "begin", "verify", "apply", "accept"):
            self.check(f"action === '{action}'" in text, "UNKNOWN_PROGRESS_COMMAND", path,
                       f"CLI 不支持 {action}。", "正文命令必须对应实际入口。")
        for token in ("['run', 'type-check']", "['run', 'test:unit', '--', '--run']", "['run', 'build']",
                      "backendBuild: 'NOT_CHECKED'", "businessAcceptance: 'NOT_CHECKED'", "JOURNEY_IMPLEMENTATION_REQUIRED"):
            self.check(token in text, "VERIFY_SEMANTICS", path, f"verify 语义发生变化：{token}", "重新人工审查并同步课程说明和静态验证器。")
        self.check("VS Code" not in text, "OLD_IDE", path, "冲突提示仍指向 VS Code。", "使用 CodeBuddy IDE 术语。")
        for n, commands in (("11", ("npm --prefix frontend run test:unit -- --run src/tests/http.test.ts",
                                   "node tools/course.mjs check", "node tools/course.mjs build")),
                            ("12", ("node tools/course.mjs check", "node tools/course.mjs build", "node tools/hand-in.mjs"))):
            content = "\n".join(page.stations.get(n, []))
            for command in commands:
                self.check(command in content, "MISSING_FINAL_COMMAND", "journey/index.html",
                           f"第 {n} 站没有确切命令：{command}", "补学生可以直接执行的命令。")
        reference = self.root / "resources/project-journey/reference"
        package = self.json(reference / "frontend/package.json")
        for name in ("type-check", "test:unit", "build", "dev"):
            self.check(name in package["scripts"], "NPM_SCRIPT", "resources/project-journey/reference/frontend/package.json",
                       f"缺 npm script {name}", "修正文档命令或恢复脚本。")
        for file in ("tools/course.mjs", "tools/hand-in.mjs", "frontend/src/tests/http.test.ts", "frontend/src/api/campus.ts"):
            self.read(reference / file)
        prep = self.text("journey/00-怎么开始.md")
        for token in ('export PATH="$JAVA_HOME/bin:$PATH"', '$env:Path = "$env:JAVA_HOME\\bin;$env:Path"', 'doctor-env', 'build-backend'):
            self.check(token in prep, "ENVIRONMENT_REPAIR", "journey/00-怎么开始.md", f"环境步骤缺少{token}", "同时设置JAVA_HOME/PATH，未完成前端时单独构建后端。")
        runtime = self.text(reference / "tools/course.mjs")
        self.check("action === 'build-backend'" in runtime and "PATH中的java不是17" in runtime, "RUNTIME_ENVIRONMENT", "tools/course-template.mjs", "环境/后端独立构建未进入包", "修模板并重建。")
        exporter = self.text(reference / "tools/hand-in.mjs")
        for token in ("'lesson-bundles'", "'.codebuddy'", "'journey-backups'"):
            self.check(token in exporter, "EXPORT_EXCLUSIONS", "tools/hand-in-template.mjs", f"交付缺少排除{token}", "交付当前实现，不带答案/模型配置/备份。")
        self.check("path.join(root,'../docs')" not in exporter, "EXPORT_PARENT_READ", "tools/hand-in-template.mjs", "仍自动读取app外材料", "仅导出当前app内docs/project-docs。")
        for n, filename in ((5, 'energy-scope.test.ts'), (6, 'monitoring-views.test.ts'), (8, 'case-trigger-race.test.ts'), (9, 'closure-wiring.test.ts'), (10, 'workflow-views.test.ts')):
            path = f"resources/project-journey/app/lesson-bundles/stage-{n:02}/manifest.json"
            self.check(any(x['path'].endswith(filename) for x in self.json(path)['files']), "LATE_REGRESSION", path, f"{filename}未随功能引入", "把回归放到对应站，而非等到第11站。")
        self.criteria.append("按实际 progress.mjs 分派器和 npm scripts 核对命令；verify 仅前端，后端/业务保留 NOT_CHECKED。")

    def build_binding(self):
        path = "journey/build.json"
        build = self.json(path)
        self.check(build.get("sha256") == sha(self.read("journey/index.html")), "HTML_HASH", path,
                   "入口 HTML 与 build.json 哈希不符。", "用 build-journey.mjs 重新构建。")
        for source in build.get("sources", []):
            self.record(self.root, source, path)
        bound = {x["path"] for x in build.get("sources", [])}
        for required in ("journey/lessons.json", "tools/build-journey.mjs", "tools/journey.js", "tools/journey.css"):
            self.read(required)
            self.check(required in bound, "UNBOUND_BUILD_SOURCE", path,
                       f"HTML 构建报告未绑定关键源 {required}", "把该源纳入 build.json.sources 后重建。")
        self.check(build.get("offlineBrowserVerified") is False and build.get("codeBuddySessionExecuted") is False,
                   "EXECUTION_CLAIM", path, "静态生成不应自称浏览器或 AI 会话实测。", "将实测证据与静态构建分开。")
        self.read("tools/build-progress-project.mjs")
        self.criteria.append("入口 build.json 绑定当前 HTML、Markdown、元数据、生成器、CSS/JS；所有审计输入再绑定独立摘要。")

    def run(self):
        packaged_verifier = self.read("tools/verify-journey-static.py")
        self.check(sha(packaged_verifier) == sha(Path(__file__).read_bytes()), "VERIFIER_DRIFT",
                   "tools/verify-journey-static.py", "实际执行的验证器与被查包内版本不同。", "使用包内验证器或同步已审版本后重跑。")
        lessons = self.json("journey/lessons.json")
        page = self.html()
        self.manuscripts(lessons)
        self.manifests()
        self.commands(page)
        self.build_binding()
        for path, record in list(self.bound.items()):
            if sha(self.file(path).read_bytes()) != record["sha256"]:
                self.issue("SOURCE_CHANGED_DURING_CHECK", path, "检查期间源发生变更。", "停止编辑后重跑，不能沿用本报告。")

    def report(self):
        entries = [{"path": p, **v} for p, v in sorted(self.bound.items())]
        digest = sha(json.dumps(entries, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode())
        report = {
            "schema": 1, "checkedAt": datetime.now(timezone.utc).isoformat(),
            "status": "FAIL" if self.findings else "PASS_STATIC", "kind": "STATIC_ONLY",
            "sourceDigest": digest, "counts": dict(self.counts), "criteria": self.criteria,
            "findings": self.findings, "boundFiles": entries,
            "notExecuted": ["browser/file://", "HTTP server or API", "CodeBuddy AI session", "Windows runtime",
                            "Node/npm/Maven builds or tests", "database", "classroom timing", "real AIRIOT"],
            "interpretation": "PASS_STATIC 仅证明列出的当前文件与静态规则；四要素存在不证明新手操作成功，不能据此签课程业务完成。",
        }
        directory = self.output_dir
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "static-review.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        lines = ["# 新主线静态审读", "", f"结论：**{report['status']}**。仅静态，不是实机或课堂验收。", "",
                 f"检查时间：{report['checkedAt']}", f"源摘要：`{digest}`", "",
                 "## 覆盖", "", *[f"- {x}" for x in self.criteria], "",
                 "统计：" + "；".join(f"{k}={v}" for k, v in self.counts.items()), "", "## 需修正", ""]
        if self.findings:
            for item in self.findings:
                location = item["path"] + (f":{item['line']}" if item["line"] else "")
                lines.append(f"- `{item['code']}` · `{location}`：{item['message']} {item['remedy']}")
        else:
            lines.append("本轮所列静态规则无未解决阻断。")
        lines += ["", "## 边界", "", report["interpretation"], "",
                  "未执行：" + "、".join(report["notExecuted"]) + "。", "",
                  "完整逐文件 SHA-256 与字节数见同目录 static-review.json。源变更后必须重跑；旧摘要不覆盖新文件。", ""]
        (directory / "static-review.md").write_text("\n".join(lines))
        print(json.dumps({"status": report["status"], "sourceDigest": digest, "counts": dict(self.counts),
                          "findings": self.findings, "report": str(directory / "static-review.json")}, ensure_ascii=False, indent=2))
        return 1 if self.findings else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--course-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output-dir", type=Path, help="新报告目录；本轮指定独立路径，保留历史报告")
    args = parser.parse_args()
    audit = Audit(args.course_root, args.output_dir)
    try:
        audit.run()
    except (OSError, ValueError, KeyError, TypeError) as error:
        audit.issue("AUDIT_INCOMPLETE", "audit", str(error), "补齐输入或修正验证器后重跑；本次不能算通过。")
    raise SystemExit(audit.report())


if __name__ == "__main__":
    main()
