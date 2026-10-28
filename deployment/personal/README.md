# GitHub.com 个人账号独立实例

- 认证主机：`github.com`；与两个 GHE.com 企业账号分别授权。
- 后端：`127.0.0.1:4145`，`copilot-personal.service`。
- HTTPS：`https://edge-fsd.japaneast.cloudapp.azure.com/personal/v1`。
- 程序：`/home/taoli1/copilot-personal/main.js`，复制指定 commit 的 `dist/main.js`。
- 私有状态：`/home/taoli1/.local/share/copilot-personal/`，不进入 Git。
- 客户端配置：`~/.config/edge-proxy/personal.env`。

2026-10-28 已授权并上线的账号为 `taoli1ms`。token 返回的模型地址为
`https://api.enterprise.githubcopilot.com`，可见 36 个模型；Chat Completions、
Responses 流式终态及 Decision 均已实测成功。发布记录见
[personal-rollout-20261028.md](../personal-rollout-20261028.md)。

该实例有独立 API key、OAuth token 和统计，不跨账号轮询。`individual` 表示
GitHub.com 默认连接方式；实际模型地址优先使用 token 返回的 `endpoints.api`。
账号的企业成员身份、计费归属和模型权限仍由 GitHub 决定。

## 授权与安装

```sh
node main.js auth --github-host github.com --data-dir /private/copilot-personal
```

账号持有人通过 GitHub 官方设备授权页面完成登录。通过 SSH 将收到的
`github_token` 和独立随机 `sk-personal-` 客户端密钥传到 VM 私有暂存目录。
不要在命令参数、Azure Run Command 脚本或日志中放入凭据内容。

先按上级 `deployment/README.md` 检查、提交代码并同步指定 commit，再执行：

```sh
sudo python3 deployment/personal/install.py \
  --token-file /private/github_token \
  --key-file /private/client-key.txt \
  --expected-login taoli1ms
```

安装器核对实际 GitHub 登录名，检查 Git、生产清单、端口和已有安装，备份 Nginx，
启动新实例并检查模型列表，然后验证 Nginx 配置、reload 并启用服务。
启动或路由检查失败时恢复 Nginx 并移除新 unit；程序和私有状态保留用于诊断，
重试前需检查并处理这两个目录。已存在的安装会被拒绝，避免覆盖状态。
所有原有 Copilot 和其他代理监听进程、主程序和 dashboard 文件必须保持不变。

发布后检查公网模型列表、错误密钥和跨实例密钥返回 401，以及实际模型调用。
确认成功后清理临时 token/key 副本和临时 SSH 授权。后续重新授权使用相同私有
状态目录，只重启 `copilot-personal.service`。

## 五套客户端配置

本机统一目录为 `~/.config/edge-proxy/`，每份文件均为以下两项：

```dotenv
OPENAI_BASE_URL=https://edge-fsd.japaneast.cloudapp.azure.com/personal/v1
OPENAI_API_KEY=<该实例的独立密钥>
```

| 配置文件 | 实例 | URL 路径 | 后端端口 |
| --- | --- | --- | --- |
| `main.env` | 原主号 | `/v1` | 4141 |
| `alt.env` | ALT | `/alt/v1` | 4142 |
| `msft.env` | msft.ghe.com | `/msft/v1` | 4143 |
| `microsoft.env` | microsoft.ghe.com | `/microsoft/v1` | 4144 |
| `personal.env` | 新增 GitHub.com 个人账号 | `/personal/v1` | 4145 |

各文件包含私有密钥，不能加入仓库。目录内的本地 `README.md` 提供导入示例。
