# Git 协作实训

Git 在本机保存可以比较的源码版本。commit 是有说明的版本记录；分支隔离一项改动；review 由同伴核对改动和证据；merge 把确认后的改动合回主线。本练习不需要 GitHub 账号、真实姓名或联网推送。

练习 A 占第01课第1步10分钟，B 占第10课第4步15分钟，C 占第10课第5步10分钟，均计入原课步和每课180分钟。其余课末提交使用原有记录时间，不新增课外必做任务。

## 练习 A：第一张页面的版本记录（10分钟）

**先想，1分钟：** 写下准备保存的文件，以及不应进入版本的材料。运行 `git --version`；未安装时由教师课前按[Git 官方安装入口](https://git-scm.com/install/)完成安装。

**亲手做，7分钟：** 第01课第1步页面检查后，另开不运行服务的工具终端，工作目录是自己的 `campus-lab`。先运行：

```sh
git rev-parse --show-toplevel
```

提示 `not a git repository` 才继续初始化；返回当前 `campus-lab` 则跳过 `git init`；返回其他目录则先让老师确认工作位置，不在教材仓库、父仓库或主目录练习，不删除已有 `.git`。

```sh
git init -b main
git config --local user.name "campus-group-a"
git config --local user.email "campus-group-a@example.invalid"
git status --short
```

两条 `config --local` 只为新建课程仓库设置小组代号。已有仓库沿用经本人确认的身份，不覆盖别人配置。`example.invalid` 是本机练习标识；不加 `--global`，不配置远端，不执行 `push`。

在编辑器创建根目录 `.gitignore`；已有则保留原规则，只补缺项：

```gitignore
.env
.env.*
!.env.example
.private/
.runtime/
node_modules/
target/
dist/
*.log
*.zip
.DS_Store
```

`.env.example` 只能含配置名和占位说明。以后创建 `.env` 前运行 `git check-ignore .env`，应输出 `.env`。忽略规则不会移除已经跟踪的文件；若 `git ls-files -- .env` 有输出，停止提交，由老师检查，不投屏文件内容。

先在编辑器读新文件，再逐条执行：

```sh
git status --short
git diff -- frontend/index.html tools/serve.mjs
git add -- .gitignore frontend/index.html tools/serve.mjs
git diff --cached --stat
git diff --cached
git commit -m "feat(page): add first campus page and local server"
git log -1 --oneline
```

`??` 是尚未跟踪，`M` 是已跟踪文件被修改。新文件在 `add` 前不出现在普通 `diff` 中，所以先读文件；`diff --cached` 显示即将提交的内容。本次只暂存这三个明确路径，其他练习资料仍可能显示未跟踪，不等于失败。不使用 `git add .` 或 `git add -A`。

**解释与证据，2分钟：** 记下提交短编号、三个文件的作用，以及“暂存”和“提交”的区别。错误就记录错误，未提交写“未提交”。后续每课结束按“status → diff → 明确路径 add → cached diff → commit”保存已核查的功能、测试、公开笔记。提交前读新文件，不纳入运行产物或私密材料。

提交信息采用 `类型(范围): 具体变化`，如 `fix(reading): preserve zero power values`、`test(owner): reject stale versions`、`docs(handoff): record actual startup steps`。“update”无法说明改变了什么。

## 练习 B：功能分支、同伴 review 与合并（15分钟）

嵌入第10课第4步“空间保存”。在编码前建分支，实际检查后评审合并。两人在一个本地工程轮换操作，不需远端仓库。

**先想并开分支，3分钟：** 写目标：“管理员保存空间后独立回读，查看者写入被拒”，关联 `FR-03`（空间）、`NFR-01`（权限）、`NFR-04`（持久保存）。先完成前面课步的合法提交：

```sh
git status --short
git branch --show-current
```

确认在 `main`，没有前面课步未提交的源码/记录。有改动先辨认来源并提交已检查且属于自己的部分；不认识的请老师判断，不靠删除、stash 或重置清空。然后：

```sh
git switch -c feat/space-save
```

分支已存在时用 `git branch --list` 确认进度，不覆盖删除。继续本步编码、测试和亲自操作。

**同伴 review，7分钟：** 将[同伴评审记录](templates/同伴评审记录.md)复制到学生工程 `docs/reviews/第10课空间保存评审.md`，填写真实文件和证据。同伴运行：

```sh
git status --short
git diff --stat
git diff
```

新增文件也要打开正文。检查：仅改空间保存；后端拒绝查看者写入；成功后独立 GET 回读、失败保留错误；测试有允许和拒绝路径。写具体发现，或带核查依据的“未发现问题”，不能只写“同意”。作者修正后，同伴重查受影响行为并记录。

**提交合并，5分钟：** 暂存固定存在的前端及评审文件：

```sh
git add -- frontend/data-service.js frontend/app.js "docs/reviews/第10课空间保存评审.md"
```

再根据 `git status --short`，对本步每个 Java、测试或迁移文件分别输入 `git add -- "完整相对文件路径"`；引号内替换为列表中实际路径，不照抄占位文字。不属于本步的不加入。检查全部必要文件后：

```sh
git diff --cached --stat
git diff --cached
git commit -m "feat(space): save space with role checks and readback"
git status --short
git diff main...HEAD --stat
git diff main...HEAD
git switch main
git merge --ff-only feat/space-save
git log -3 --oneline
```

切回主线前不得留下本步未提交改动；遗漏则在功能分支补交复核。`--ff-only` 只允许主线未分叉时直接前进；拒绝时请老师检查分支图，不强制覆盖。合并后在 `main` 重做空间回读和查看者拒绝检查，结果留在 `docs/测试记录.md`，评审留在 `docs/reviews/第10课空间保存评审.md`，提交短号及文件链接记入 `docs/本组实做记录.md`。主工程不故意制造冲突。

## 练习 C：独立目录里的文本冲突（10分钟）

**准备，2分钟：** 在文件管理器新建与 `campus-lab`、教材仓库并列的空目录 `course-git-conflict-01`，用新窗口打开。目录已有内容时换新名字。运行 `git rev-parse --show-toplevel`，只有提示不是仓库才继续：

```sh
git init -b main
git config --local user.name "conflict-practice"
git config --local user.email "conflict-practice@example.invalid"
```

编辑器创建 `notice.txt`，仅写 `Meeting: Monday` 一行，保存：

```sh
git add -- notice.txt
git commit -m "docs(notice): record initial meeting day"
git switch -c feat/change-day
```

**制造冲突，3分钟：** 在此分支把该行改为 `Meeting: Tuesday` 并保存：

```sh
git add -- notice.txt
git commit -m "docs(notice): propose Tuesday"
git switch main
```

在 `main` 将同一行改为 `Meeting: Friday`，保存：

```sh
git add -- notice.txt
git commit -m "docs(notice): propose Friday"
git merge feat/change-day
git status --short
```

出现 `CONFLICT`、`UU notice.txt` 是本实验预期，尚未合并完成。打开文件找 `<<<<<<<`、`=======`、`>>>>>>>`：双方修改同一行，Git 需要人决定语义，不应只按“接受全部”。

**解决并解释，5分钟：** 两人约定 `Meeting: Wednesday`，在编辑器把整个冲突块改成这一行，移除全部标记并保存：

```sh
git diff --check
git add -- notice.txt
git diff --cached
git commit -m "merge(notice): agree on Wednesday"
git status --short
git log --oneline --graph --all -5
```

检查文件只有约定内容、状态干净、图中有分支及合并记录。记录冲突原因、两种提议、最终决定和编号。暂时无法决定时，只能在本实验合并前状态干净的前提下用 `git merge --abort` 回到合并前；不在主工程试 `reset --hard`、`clean` 或删目录。重做用新空目录，不清理旧成果。

本机提交不代表已经推送 GitHub。后续公开范围、组织、身份由单独交付要求决定。命令含义可查 [Git init](https://git-scm.com/docs/git-init) 与 [Git merge](https://git-scm.com/docs/git-merge) 官方文档。
