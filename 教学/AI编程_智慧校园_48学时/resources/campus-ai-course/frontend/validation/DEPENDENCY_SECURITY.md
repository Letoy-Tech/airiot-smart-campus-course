# 教学前端依赖安全冻结

执行日期：2026-10-18。只修改本独立教师参考前端的 package、lock 与本目录说明/验证记录；不修改原 system、后端、夹具或学生副本。服务由主任务在依赖完成后重启，本子任务未停止任何进程。

## 修复范围

本次更新前实际 `npm audit --json` 报告13项：10 high、2 moderate、1 low。依赖树的审计命中不能直接等同于浏览器可利用路径；本工程为客户端渲染，没有启用Vue SSR，但仍统一修复被报告的依赖。

| 主包 | 更新前 | 冻结版本 | 依据 |
| --- | --- | --- | --- |
| vue | 3.5.30 | 3.5.44 | [Vue server-renderer 官方公告](https://github.com/vuejs/core/security/advisories/GHSA-g2v6-rqmx-r4w6)与本次npm审计范围；不把页面未使用SSR当作锁文件不修复的理由 |
| vite | 7.3.1 | 7.3.7 | [Windows路径处理官方公告](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff)，Vite7首修为7.3.5；[WebSocket文件读取公告](https://github.com/vitejs/vite/security/advisories/GHSA-p9ff-h696-f583)首修为7.3.2 |
| vitest | 4.1.0 | 4.1.12 | [Vitest mock重定向官方公告](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)，首修为4.1.11 |

保持Node22、Vue3、Vite7、Vitest4。没有使用 `npm audit fix --force`、legacy-peer-deps 或 overrides。传递依赖按其父包允许范围定向重解析：

| 依赖 | 最终锁版本 |
| --- | --- |
| esbuild | 0.28.2 |
| brace-expansion | 2.1.7 |
| js-cookie | 3.0.8 |
| nanoid | 3.3.20 |
| picomatch | 4.0.7 |
| postcss | 8.5.30 |
| source-map-js | 1.2.2 |
| undici | 7.30.1 |

Vite7.3.7的[官方package.json](https://github.com/vitejs/vite/blob/v7.3.7/packages/vite/package.json)允许esbuild `^0.27.0 || ^0.28.0`，因此0.28.2在合法范围内。新锁也重新校准了开发依赖标记，例如tinyglobby的dev:true；不再沿用初次裁剪锁中的遗漏标记。

## 生成与安装工具

所有npm命令都在绝对工作目录 `resources/campus-ai-course/frontend/` 对应的本工程目录执行，并已确认package名称。

1. 修改三个直接包的精确版本。
2. Node22.21.1自带npm10.9.4生成锁时复现Arborist内部 `edgesOut` 错误。初次prefer-offline也遇到旧注册表缓存的ETARGET；在线重新核对后已消除，并非目标版本不存在。
3. **锁生成工具：Node22.21.1运行本机npm11.16.0。** 先用 `install --package-lock-only --ignore-scripts --prefer-online` 解析三个主包，再对上表八个传递包执行 `update <包名列表> --package-lock-only --ignore-scripts --prefer-online`。不改变课堂要求的npm版本。
4. **实际安装与验证：Node22.21.1 / npm10.9.4。** 使用 `npm ci --prefer-online --fetch-timeout=20000 --fetch-retries=1 --no-audit --no-fund`，exit0，安装189包；锁文件包含238条跨平台包记录。

安装仍出现glob10.5.0的上游弃用提示。它与本次npm审计结果分别记录；当前审计没有剩余报告项，本轮没有为消除弃用文案而扩大主版本升级。

## 实际验证结果

以下全部在2026-10-18 23:23（Asia/Shanghai）执行，未替代Windows真机或浏览器联调：

| 检查 | 结果 |
| --- | --- |
| `npm run type-check` | exit0 |
| `npm run test:unit -- --run` | Vitest4.1.12，3文件24项通过，exit0 |
| `npm run build` | Vite7.3.7，24模块，exit0；JS93.47kB、CSS13.26kB |
| `npm audit --json` | exit0，info/low/moderate/high/critical/total全部0 |
| `npm audit --json --omit=dev` | exit0，全部0 |

审计完成时间为 `2026-10-18T15:23:35.033933Z`。原始结果文件在第四轮重新执行后已更新为最新依赖审计：[全量审计](npm-audit-all.json)、[生产依赖审计](npm-audit-production.json)。本节 24 项测试与下方 hash 是第三轮历史结果，当前标识见第四轮记录。结论只反映执行时的公告库与本锁文件，不代表未来新增公告或整套软件安全验收。整个validation目录仅供教师参考，学生生成器排除此目录。

最终锁定标识：

```text
package.json SHA-256
d06bdc0dcaaca2cd18c4131147a7e28eb4c60cf8664327597baa4ac5106725e9
package-lock.json SHA-256
c4251b4445b3012fdf23add54639702f338e0f323cd746b02459aa1e991f156c
本次替换前锁 SHA-256
789f85ef164a45f0e4a6a5bef09351d0aa7f72446b654dd46f840454d09b4704
```

主任务已收到重启通知，接下来同步学生副本并复核登录/设备链路。本次没有改变业务源码或页面交互，不把依赖单元测试通过描述为浏览器重新验收通过。


## 第四轮新增图表依赖（2026-10-19）

当前最终锁添加 ECharts 6.1.0 / zrender 6.1.0，重新审计全量与 omit=dev 均0。6.0.0 被实测审计报告1项moderate后已修补。当前安装、41项测试、构建、工具和SHA-256详见 [第四轮验证](ROUND4_FRONTEND.md)。旧第三轮24项结果不覆盖新业务页面。
