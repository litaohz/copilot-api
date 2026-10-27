# Microsoft 企业实例与 SystemOne 发布回执

- 发布时间：2026-10-27 02:26:44 UTC（北京时间 10:26:44）。
- 目标：FSD VM `VPN0707/vm0707new`。
- 运行代码 commit：`bb585b2f78781e8c819bf834cd9d1c3c6a79ebda`。
- 分支：`codex/microsoft-systemone-proxy`。
- 程序 SHA-256：`a1d5082ec405c63390e5b9b0aa4408145cfab113d51c07dbed2ba5e08ec6e6e1`。
- 新服务：`copilot-microsoft.service`，已 active、enable，监听 `127.0.0.1:4144`。
- 新入口：`https://edge-fsd.japaneast.cloudapp.azure.com/microsoft/v1`。
- 授权账号：`taoli1`，企业主机 `microsoft.ghe.com`；实际模型主机为
  `https://copilot-api.microsoft.ghe.com`，来自 token 响应。
- 本机配置：`~/.config/edge-proxy/microsoft.env`；独立 key 同时保存在
  `%LOCALAPPDATA%/CopilotMicrosoftProxy/client-key.txt`，不进入 Git。
- VM 私有状态：`/home/taoli1/.local/share/copilot-microsoft/`，目录 `0700`，
  token 与 `service.env` 为 `0600`。

## 发布范围与回滚

主服务、ALT、MSFT 和 Microsoft 使用同一份经验证的构建。前三个服务逐个重启；
没有执行 `pm2 restart all`。ALT 原 bundle 为 2026-10-10 初始基线，本次同时取得
源码已有的上游结构化错误处理和企业 endpoint 选择。Nginx 增加 Microsoft prefix；
原有 `/v1/`、`/alt/v1/` 和 MSFT prefix 已涵盖 SystemOne，无需改写原路由。

发布前已保存各服务实际运行文件和 Nginx：
`/root/copilot-systemone-deployment/20261027T022644Z/`。
新实例安装器另存回执与 Nginx 备份：
`/root/copilot-microsoft-deployment/20261027T022646Z/`。
回滚代码 commit 为 `f4e4ce17ec07197c724d4b1f78525132f66bbce0`，ALT 和 MSFT
应同时恢复私有快照中的原件，再逐个重启对应服务；新实例需停用并还原 Nginx。

预检曾发现严格 umask 下的应用目录权限，以及 srvx 0.8.9 的 Node request signal
在正常读完正文时提前触发的问题，均已修复。后者导致一次自动回滚；修复后的真实
HTTP socket 测试在本机 Node 24 和 VM Node 20.19.4 均通过，随后发布成功。

## 验证结果

- 类型检查、Lint、93 项 Bun 测试、临时目录构建通过。
- 本地和 VM `deployment/verify.py --git` 通过；VM 同时核对实际 `/dash`。
- 四个端口各返回 36 个模型；均包括 `microsoft-decision-1`。
- Microsoft 公网 GPT-4.1 Chat 返回 200；GPT-6.1-sol Responses 返回 200，
  输出 `OK` 且终态为 `response.completed`。
- Microsoft、MSFT、ALT 公网错误 key 和跨实例 key 均返回 401。
- 四个实例本地 SystemOne 请求返回原始上游 `400 text/plain; charset=utf-8`，
  正文为 `Bad Request\n`；错误 key 为 401。Microsoft、MSFT、ALT 的公网结果相同。
- Microsoft 直连上游与代理对同一标准聊天正文返回相同的 400 和正文。
- `/dash`、两个原有 `.mjs` 文件字节不变；Cursor 和 AGY 的监听进程未变化。

首次发布时专用 payload schema 尚未确认；以上 400 验证的是路径、鉴权和原样
错误转发，不能当作成功取得 Decision 决策结果。

## 同日后续：按官方 schema 调用成功

用户提供 Microsoft Foundry 官方文档后，使用 `model`、`state`、`questions` 格式，
主号、Microsoft、MSFT、ALT 公网入口均返回 200，`choice`、`score`、`noul` 三种类型均成功。
此验证复用了已部署的程序，没有修改运行代码或重启服务。
可复用请求及 Foundry/Copilot 的 URL、模型名称和认证差别见 [systemone.md](systemone.md)。
