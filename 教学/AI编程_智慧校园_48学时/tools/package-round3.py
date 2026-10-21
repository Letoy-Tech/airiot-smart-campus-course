"""校验并归档V0.4；不打包凭据、依赖、构建产物或旧轮过程截图。"""
from pathlib import Path
import datetime
import hashlib
import json
import re
import urllib.parse
import zipfile

ROOT = Path(__file__).resolve().parent.parent
EXCLUDE = {"node_modules", "target", "dist", ".private", ".runtime", ".cache", "__pycache__", ".git"}
MANIFEST = ROOT / "delivery-manifest-v0.4.json"

def sha(data):
    return hashlib.sha256(data).hexdigest()

def json_read(file):
    return json.loads(file.read_text())

def save(file, value):
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")

def included(file):
    rel = file.relative_to(ROOT)
    if not file.is_file() or any(part in EXCLUDE for part in rel.parts):
        return False
    if file.name == ".DS_Store" or file.suffix in {".log", ".pdf"}:
        return False
    if file.name.startswith(".env") and file.name != ".env.example":
        return False
    if "qa" in rel.parts and not any(part.startswith("round3") for part in rel.parts):
        return file.suffix == ".json"
    return True

def main():
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    index = json_read(ROOT / "course-index.json")
    assert len(index["chapters"]) == 12
    assert sum(c["class_hours"] for c in index["chapters"]) == 48
    assert index["lab_verified"] is False
    readers = ["index", "AI编程图文稿_V0.4_单文件"]
    qa_dirs = ["round3-book", "round3-standalone"]
    for reader, qa in zip(readers, qa_dirs):
        html = ROOT / "reading" / f"{reader}.html"
        build = json_read(html.with_suffix(".build.json"))
        report = json_read(ROOT / "illustrations/qa" / qa / "verification.json")
        assert report["status"] == "PASS"
        assert report["inputSha256"] == sha(html.read_bytes()) == build["sha256"]
        for doc in build["documents"]:
            assert sha((ROOT / doc["file"]).read_bytes()) == doc["sha256"], doc["file"]
        assert len(build["figures"]) == 40 if isinstance(build["figures"], list) else build["figures"] == 40
    assert json_read(ROOT / "illustrations/qa/round3-resources/verification.json")["status"] == "PASS"
    project = ROOT / "resources/campus-ai-course"
    assert json_read(project / "evidence/browser/verification.json")["status"] == "PASS"
    assert json_read(project / "evidence/verification.json")["status"] == "PASS_WITH_EXPLICIT_SCOPE"
    for file in (project / "frontend/validation").glob("npm-audit-*.json"):
        assert json_read(file)["metadata"]["vulnerabilities"]["total"] == 0
    preserved = ROOT.parent / "AI编程_智慧校园_48学时_V0.3_第二轮图文稿.zip"
    assert sha(preserved.read_bytes()) == "a99c196b9f16d36510358a3fced8d2487efe8e804e74deff5f9e0131db3fb184"
    baseline = json_read(ROOT / "handoffs/round3-baseline.json")
    protected = [row for row in baseline["files"] if row["path"].startswith("reading/AI编程图文稿_V0.3_")]
    for row in protected:
        assert sha((ROOT / row["path"]).read_bytes()) == row["sha256"]
    files = [f for f in sorted(ROOT.rglob("*")) if included(f)]
    local_links = external_project_links = 0
    for file in files:
        if file.suffix != ".md":
            continue
        content = re.sub(r"```[\s\S]*?```", "", file.read_text())
        for raw in re.findall(r"\]\(([^\n]*?)\)", content):
            raw = raw.strip().strip("<>")
            if raw.startswith(("http:", "https:", "mailto:", "#")):
                continue
            target = urllib.parse.unquote(raw.split("#")[0])
            if not target:
                continue
            destination = (file.parent / target).resolve()
            assert destination.exists(), (file, target)
            if destination.is_relative_to(ROOT):
                assert included(destination), (file, "link excluded from archive", target)
                local_links += 1
            else:
                external_project_links += 1
    # 只读取本次生成的教学密码，不输出其值；扫描每个待归档文件。
    private = project / ".private/accounts.json"
    secrets = [a["password"].encode() for a in json_read(private)["accounts"]] if private.exists() else []
    for file in files:
        data = file.read_bytes()
        assert not any(value in data for value in secrets), f"本地密码进入交付候选：{file.relative_to(ROOT)}"
    index["document_checks"] = "PASS"
    index["delivery_manifest"] = MANIFEST.name
    save(ROOT / "course-index.json", index)
    save(ROOT / "illustrations/qa/round3-document-checks.json", {
        "status": "PASS", "generatedAt": now, "chapters": 12, "classHours": 48,
        "figures": 40, "embeddedResources": 13, "localLinks": local_links,
        "originalProjectLinks": external_project_links, "readerSourceHashesMatch": True,
        "v03ArchiveUnchanged": True, "v03StandaloneUnchanged": True,
        "credentialScan": "No current generated local password in candidates; private paths excluded",
        "labVerified": False,
    })
    files = [f for f in sorted(ROOT.rglob("*")) if included(f) and f != MANIFEST]
    save(MANIFEST, {
        "version": "0.4", "createdAt": now,
        "scope": "教材图文稿与首次链路参考/学生资源，非全课程实验通过",
        "historicalManifest": "delivery-manifest.json (V0.3 preserved)",
        "excludes": sorted(EXCLUDE) + ["*.log", "*.pdf", "旧轮过程截图与HTML"],
        "files": [{"path": str(f.relative_to(ROOT)), "bytes": f.stat().st_size, "sha256": sha(f.read_bytes())} for f in files],
    })
    files.append(MANIFEST)
    archives = []
    for name, selected, parent in [
        ("AI编程_智慧校园_48学时_V0.4_图文与起步资源.zip", files, ROOT.parent),
        ("AI编程_第04章学生起点_V0.4.zip", [f for f in files if f.is_relative_to(ROOT / "resources/student-workspace")], ROOT / "resources"),
    ]:
        output = ROOT.parent / name
        if output.exists():
            raise RuntimeError(f"拒绝覆盖已有归档：{output}")
        with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for file in selected:
                archive.write(file, str(file.relative_to(parent)))
        with zipfile.ZipFile(output) as archive:
            assert archive.testzip() is None
            for file in selected:
                assert sha(archive.read(str(file.relative_to(parent)))) == sha(file.read_bytes())
        digest = sha(output.read_bytes())
        output.with_suffix(output.suffix + ".sha256").write_text(f"{digest}  {output.name}\n")
        archives.append({"file": output.name, "files": len(selected), "bytes": output.stat().st_size, "sha256": digest, "crcAndHashes": "PASS"})
    save(ROOT.parent / "AI编程_智慧校园_48学时_V0.4_交付校验.json", {"status": "PASS", "generatedAt": now, "archives": archives})
    print(json.dumps({"status": "PASS", "localLinks": local_links, "originalProjectLinks": external_project_links, "archives": archives}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
