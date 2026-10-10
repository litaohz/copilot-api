# FSD 代码与部署基线

本仓库是 FSD 主服务与 `/dash` 监控页面的统一维护入口。2026-10-10 的整理先锁定线上运行版本，再把未进入源码的补丁还原到 `src/`；没有用新构建替换正在运行的服务。

## 代码归属

| 内容 | 维护位置 | 来源 |
| --- | --- | --- |
| Copilot 代理与协议转发 | `src/` | `billxc/copilot-api`，1.2.6，`e2ee6706bd31a8f1ae14422f48411d909394f05f` |
| API key、管理接口、请求统计 | `src/lib/auth.ts`、`src/lib/stats*.ts`、`src/routes/admin/` | 原服务器未提交源码及线上多密钥补丁 |
| GPT-6 流式 ID 兼容 | `src/lib/responses/` | 线上已部署的两个 `.mjs` 文件，原字节保留 |
| 监控页面 | `dashboard/` | 当前 `/dash` 静态页面，原仓库 `litaohz/edge-proxy-dashboard` |
| 正在运行的成品 | `dist/main.js`、`dist/*.mjs` | 线上原件，Git 跟踪并逐文件校验 |
| 验证与溯源 | `deployment/`、`tests/` | 本次整理 |

增强代码的历史来源是 `litaohz/edge-proxy-dashboard`，本地提交 `5cbf3c9031269929a0f15b4844bf6eb54a49c5f3`。其中核心 `stable-ids.mjs` 与线上相同，但该提交的包装器已改为严格匹配 SSE MIME；线上仍采用 `includes('text/event-stream')`。本次保留线上行为，不把尚未上线的判断修正混入同步。

`captured-manifest.json` 是整理前导出的 83 个代码文件哈希；`production-manifest.json` 是同步后的仓库文件清单。前者用于保留历史差异，后者用于验证当前部署。主服务源码已补入多密钥归属、每 IP key 集合的持久化恢复、Responses 适配调用；对照测试直接执行线上运行包片段与还原后的源码，比较认证及统计行为。

## 实际运行链路

```text
edge-fsd.japaneast.cloudapp.azure.com
  /v1/*、/responses 等 → Nginx → :4141 → PM2 copilot-api
  /dash              → /var/www/edge-dash/index.html
  /alt/*             → :4142 → 独立 Copilot 账号服务
  /antigravity/v1/*   → :8317 → 独立 AGY 服务
```

主服务路径为 `/home/taoli1/copilot-api/dist/main.js`，运行时 Node 20.19.4。审计时进程 PID 为 799390，自 2026-09-09 13:55:16 UTC 启动。

主运行包 SHA-256：`bd22eb1f2a6be71c790fb3af2be1d6308b69da2f44129d95c60058164b2b021f`。它与 AGY 部署前基线一致。本次同步保持这三个运行文件及 `/dash` 原件不变；服务器会取得与 Git 相同的还原源码、页面、文档和校验脚本，不重启主进程。

## 如何检查“Git 和线上同步”

在对应 checkout 执行：

```sh
python3 deployment/verify.py --git
```

在生产目录额外检查真正被 Nginx 提供的页面：

```sh
python3 deployment/verify.py --git --deployed-dashboard /var/www/edge-dash/index.html
git rev-parse HEAD
git rev-parse '@{upstream}'
```

要求 Git 工作区/暂存区干净、两个 commit 相同、所有清单文件 SHA-256 一致、运行文件与 `HEAD` 字节一致。进程确认和 HTTP 检查另外执行；校验脚本不读取凭据、不联网、不重启。

生产 key、PM2 环境配置、GitHub token、日志和统计数据不进入 Git。`ecosystem.config.cjs`、备份和本地环境文件已显式忽略，旧工作区状态在服务器私有备份目录保留。

## 构建与后续发布

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test
bun run build --out-dir /tmp/fsd-candidate
```

正常构建现在会从 `src/` 编入全部运行补丁，不再依赖另一个仓库对压缩包做字符串替换。当前 `dist` 是原部署工件，重新构建会得到新的工件哈希；本次只验证构建，不宣称新编译结果与旧压缩包逐字节相同。

未来发布必须在独立候选目录构建、执行功能检查、更新工件与清单并提交，再部署指定 commit。不要在生产目录直接执行会清空 `dist/` 的默认构建，不要运行 `pm2 restart all`。保留旧 commit 和配套工件以便回滚。将生成的工件部署并重启视为单独的发布动作。

## 当前已知问题

以下问题保留在本次线上基线中，不把“版本同步”冒充“故障修复”：

1. **错误统计不完整。** SSE 中的 `response.failed`、`incomplete` 和中途断流没有进入请求最终状态；`durationMs` 仅到响应头就绪。HTTP 200 不等于模型执行成功。
2. **上游错误被字符串包装。** `src/lib/error.ts` 将上游 JSON 整体放进 `error.message`，丢失外层结构化 code/type，增加分类和诊断难度。
3. **取消传播被统计分流打断。** 离线执行线上 `stats-middleware.ts` 已复现：客户端取消后，`tee()` 的统计分支继续读取上游直至结束。Responses fetch 也未接收客户端 abort signal。单独适配器的取消测试通过不能代表整个服务会取消推理。
4. **权限没有隔离。** 所有有效访问 key 都能访问 `/admin/*`；`/token` 还会返回上游 Copilot token。当前多 key 是归属统计，不是独立账号或管理权限边界。此结论来自路由与认证代码，未在审计输出中获取或展示上游 token。
5. **per-key 聚合重启后丢失。** 线上补丁修复了 `byIp.keys` 的序列化，但未持久化 `byKey` 聚合；本次行为对照保留该现状，需另行修复。
6. **协议兼容性仍有证据缺口。** Responses 固定 `X-Initiator: user`，默认不转发客户端会话头；上游解密拒绝与这些因素的因果关系未证实。没有发现适配器主动修改加密正文，也不能由此排除 ID/元数据与上游加密协议的绑定。

下一步应先保留原始上游终态错误、请求 ID 与真实结束状态，再对同账号、同模型、同输入做有界对照。当前代码和机器证据不支持把解密错误直接归因于 AGY 部署；该错误早于 AGY 已出现。纯重试、缩短 review 指令或 HTTP 健康检查都不能替代这个因果验证。
