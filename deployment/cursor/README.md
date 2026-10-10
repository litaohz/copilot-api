# FSD Cursor 代理

Cursor 代理的部署入口属于当前 `copilot-api` 仓库。运行实现使用
[CLIProxyAPIPlus v7.3.12-1](https://github.com/kaitranntt/CLIProxyAPIPlus/releases/tag/v7.3.12-1)，
与此前本地验证的版本一致；固定的 Linux 发行包和可执行文件 SHA-256 见
[`release.json`](release.json)。上游源码及许可证由该项目维护，二进制不放入 Git。

## 接入

| 客户端 | Base URL |
| --- | --- |
| Anthropic / Claude Code | `https://edge-fsd.japaneast.cloudapp.azure.com/cursor` |
| OpenAI 兼容客户端 | `https://edge-fsd.japaneast.cloudapp.azure.com/cursor/v1` |

实际路径为 `/cursor/v1/messages`、`/cursor/v1/chat/completions` 和
`/cursor/v1/models`。使用独立的 Cursor 访问密钥；原 Copilot 和 Antigravity
密钥不适用。`/cursor/v1/` 之外的 Cursor 管理页面、登录回调与管理 API 不向公网开放。

本机私有密钥文件为 `%LOCALAPPDATA%\CursorProxyLab\azure-client-key.txt`。
以下 PowerShell 配置只影响当前终端，不覆盖平时的 Claude Code 配置：

```powershell
$env:ANTHROPIC_BASE_URL = 'https://edge-fsd.japaneast.cloudapp.azure.com/cursor'
$env:ANTHROPIC_AUTH_TOKEN = (Get-Content "$env:LOCALAPPDATA\CursorProxyLab\azure-client-key.txt" -Raw).Trim()
$env:ANTHROPIC_MODEL = 'claude-opus-5-5-medium'
claude --model claude-opus-5-5-medium
```

也可使用私有的独立设置文件：

```powershell
claude --settings "$env:LOCALAPPDATA\CursorProxyLab\azure-claude-settings.json" --model claude-opus-5-5-medium
```

此前本地测试已确认 `cursor-grok-4.6`、`claude-opus-5-5-medium` 和 Claude Code
文本生成可用；Claude Code 的 Read 工具调用超时，完整工具兼容性尚未确认。
此次统一部署按用户要求不重复模型请求、Claude Code 测试或测试套件。
模型目录中的其他名称不代表已经验证可用。

## 维护位置

| 内容 | 位置 |
| --- | --- |
| 固定发行版和校验和 | `deployment/cursor/release.json` |
| 安装与有界回滚脚本 | `deployment/cursor/install.py` |
| 无密钥配置模板 | `deployment/cursor/config.example.yaml` |
| systemd 单元 | `deployment/cursor/cursor-proxy.service` |
| Nginx 路由片段 | `deployment/cursor/nginx.conf` |
| 服务器可执行文件 | `/opt/cursor-proxy/cli-proxy-api-plus` |
| 服务器私有配置与 OAuth | `/var/lib/cursor-proxy/config.yaml`、`/var/lib/cursor-proxy/auth/` |
| 服务器回滚快照与回执 | `/root/cursor-proxy-deployment/<UTC timestamp>/` |

运行链路：HTTPS `/cursor/v1/*` → Nginx → `127.0.0.1:8318` →
`cursor-proxy.service` → Cursor。服务使用专用系统用户并随开机启动。
认证数据只由服务用户及 root 读取。Nginx 保留流式转发，关闭请求和响应缓冲。

Cursor 请求直接进入独立服务，**当前 `/dash` 的 Copilot 统计不包含 Cursor**。
统一维护入口不改变现有 `/v1/*`、`/alt/*`、`/antigravity/v1/*` 的归属。

## 部署与更新

在 FSD Linux VM 上，从已核对的当前仓库提交执行。先通过受保护的传输将有效
Cursor OAuth JSON 和独立客户端 key 放入 root 私有目录；不要把明文凭据写入
Git、Azure Run Command 参数或部署日志。

```sh
sudo python3 deployment/cursor/install.py \
  --auth-file /root/cursor-private/cursor-account.json \
  --client-key-file /root/cursor-private/client-key.txt
```

客户端 key 格式为 `sk-cursor-` 加至少 32 个随机字符。更新时可继续使用服务器
当前的 `/var/lib/cursor-proxy/auth/<已有文件名>.json`，避免覆盖已刷新的 OAuth。
重复部署请保持 OAuth 文件名一致。不要从本机复制整个 `auth/`，其中可能有日志。

安装脚本先检查固定校验和并创建私有快照，再写入配置、systemd 单元和 Nginx
片段。它只在 FSD 已有 HTTPS server 的 Antigravity location 之前添加 include；
找不到该结构或已有手写 `/cursor` 路由时中止。
Nginx 语法检查成功后启动或重启 Cursor、设置开机启动并 reload Nginx。
任何激活失败会恢复受影响文件及原 Cursor 运行状态，不发送推理请求。

部署后核对 `systemctl status cursor-proxy`、`systemctl is-enabled cursor-proxy`、
监听地址和回执中的文件 SHA-256。不要将进程启动等同于模型端到端验证。
仓库清单检查仍使用 `python3 deployment/verify.py --git`，线上另加
`--deployed-dashboard /var/www/edge-dash/index.html`。

## 回滚

停用本次新服务时，从 HTTPS server 中移除
`include /etc/nginx/snippets/cursor-proxy.conf;`，执行 `nginx -t` 后
`systemctl reload nginx`，然后 `systemctl disable --now cursor-proxy`。
保留私有状态目录和回执，便于恢复。

升级回滚时使用该次回执指向的快照恢复 Cursor 二进制、配置、systemd 单元和
Nginx 片段，重新载入 systemd 并只重启 Cursor。恢复 vhost 前检查期间有无其他
路由更新；不得用旧的整份 vhost 覆盖别人的后续改动。无需重启 Copilot 或 AGY。
