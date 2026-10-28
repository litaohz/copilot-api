# GitHub.com 个人账号发布回执：2026-10-28

- 安装 commit：`a91f5387945a7e3aaddc7820e732aba06cab8b7c`。
- 安装时间：2026-10-28 17:41:24（Asia/Shanghai），09:41:24 UTC。
- 官方 GitHub 设备授权账号：`taoli1ms`。
- Copilot token 返回地址：`https://api.enterprise.githubcopilot.com`。
- 公网入口：`https://edge-fsd.japaneast.cloudapp.azure.com/personal/v1`。
- 后端：`127.0.0.1:4145`；`copilot-personal.service` 为 active、enabled。
- 运行程序：`/home/taoli1/copilot-personal/main.js`，复用已提交的 `dist/main.js`。
- SHA-256：`a1d5082ec405c63390e5b9b0aa4408145cfab113d51c07dbed2ba5e08ec6e6e1`。
- Nginx 备份和安装回执：`/root/copilot-personal-deployment/20261028T094124Z/`。

安装前后四个已有 Copilot 实例、Cursor 和 AGY 的监听 PID 均未变化。
已有主程序、两个兼容模块和 dashboard 字节保持不变；Nginx 配置验证通过并 reload。
新程序目录为 `0755`，状态目录为 `0700`，token 和 service.env 为 `0600`。
凭据保存在 Git 之外，部署时通过 SSH 传输。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| 主号、ALT、MSFT、Microsoft、Personal 的公网 `/models` | 全部 HTTP 200，各 36 个模型 |
| Personal key 访问其余四个入口 | 四次均为 401 |
| 其余四套 key 访问 Personal | 四次均为 401 |
| Personal 缺失或错误 key | 两次均为 401 |
| GPT-4.1 Chat Completions | HTTP 200，回复 `OK.` |
| GPT-6.1-sol Responses SSE | HTTP 200，回复 `OK`，收到 `response.completed`，无失败或 incomplete |
| Decision / SystemOne | HTTP 200，分类 `engineering`、严重度约 2.828/3、重复联系概率约 0.99883 |

准备版本已通过 `bun run typecheck`、`bun run lint`、93 项 Bun 测试和临时目录构建。
此次安装没有重新生成或替换已有生产运行包。
安装后的 `deployment/verify.py --git --deployed-dashboard /var/www/edge-dash/index.html`
通过，136 个清单文件与指定 commit 一致；后续仅补充本发布文档和清单。

五套本机客户端配置均位于 `~/.config/edge-proxy/`：`main.env`、`alt.env`、
`msft.env`、`microsoft.env` 和 `personal.env`。各自使用独立密钥；本地 README
提供 PowerShell 与 Bash 导入示例。GitHub.com 登录形式不代表个人计费方案，实际
计费归属与模型权限仍由 GitHub 的账号配置决定。
