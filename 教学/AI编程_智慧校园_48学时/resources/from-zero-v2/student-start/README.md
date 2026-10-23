# 学生空白起点 · V2.1.0

把此文件夹命名为 campus-lab，在 CodeBuddy 中打开这一层。
先读教程“开课前”，然后从第01课开始。frontend/index.html 现在是空文件。
materials/mock-campus.json 是固定教学样本；maven-wrapper 是第07课才用的启动工具。
本包没有完整前端或后端。每课提示词让你在同一个工程中逐步生成它们。
不要从教师参考目录复制成品替代本课操作。

首次上课需要：CodeBuddy 独立 IDE、Node22、Git。安装后亲自确认 `node --version` 为22、`git --version` 可用。第01课页面验收后按教材做本机Git练习，不要求GitHub账号或推送。

第07课前准备Java17；第08课前由教师确认以下一条数据库路线，并在本工程后续课程中保持一致：

- Docker路线：Docker Desktop引擎、Compose及所需镜像下载已检查。
- 原生备用路线：教师已验收的macOS/Linux实验机，具备Python3、MySQL8.4、Redis7.2+（推荐7.4）。使用本包 `materials/native-runtime.py` 管理本课程独立进程与数据，不操作全局服务。Windows无法运行Docker时使用这样的已验收实验机。

`materials/check-environment.mjs` 用于首次启动前检查；原生路线加 `--native`。检查项按教材所处课次判断，第01课尚不要求Java或数据库已运行。端口被占用不代表可以结束那个进程。

根 `.env.example` 是公开占位模板，不是实际配置。第08课Docker路线才生成并运行 `tools/setup-env.mjs`；原生路线只运行 `python3 materials/native-runtime.py init`，不再运行setup-env，也不执行Compose。两条路线都保留已有 `.env`，不直接复制模板当密码。
不要在此时运行不存在的 serve.mjs 或后端命令，等第一课生成后再启动。
