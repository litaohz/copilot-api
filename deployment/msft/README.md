# msft.ghe.com 独立 Copilot 实例

此实例使用 `msft.ghe.com` 官方设备授权，独立端口、API key、凭据和统计目录。
不进行账号轮询或负载均衡。

- 后端：`127.0.0.1:4143`，`copilot-msft.service`。
- HTTPS 入口：`https://edge-fsd.japaneast.cloudapp.azure.com/msft/v1`。
- 程序：`/home/taoli1/copilot-msft/`，使用本仓库候选构建及同版本依赖。
- 私有状态：`/home/taoli1/.local/share/copilot-msft/`，不进入 Git。
- `github_token` 保存企业 OAuth token；`service.env` 保存独立的
  `COPILOT_API_KEY`，两者权限为 `0600`。

## 授权与启动

在运行实例的机器上执行（路径可按环境修改）：

```sh
node main.js auth --github-host msft.ghe.com --data-dir /private/copilot-msft
```

命令会输出官方网页链接、验证码和有效期。由账号持有人在网页完成登录、SSO 和授权；
不需要把浏览器密码或 token 粘贴给代理。命令会自动接收结果并保存 token。
拒绝授权或验证码过期会停止，重新执行可获得新链接。

```sh
COPILOT_API_KEY='<独立随机密钥>' node main.js start \
  --github-host msft.ghe.com --account-type enterprise \
  --data-dir /private/copilot-msft --host 127.0.0.1 --port 4143
```

`auth`、`start` 和 `check-usage` 支持 `--github-host`、`--data-dir`，也可使用
`COPILOT_GITHUB_HOST`、`COPILOT_DATA_DIR`。未指定目录时，github.com 保留原目录，
企业域名使用其独立子目录。同一域名的多个账号必须指定不同的 `--data-dir`。

GitHub API 使用 `https://api.msft.ghe.com`；模型 API 使用 Copilot token 响应中的
`endpoints.api`，刷新 token 时同步更新。企业 token 缺少该字段时启动失败，不猜测地址。
实际模型和配额取决于该企业账号的 Copilot 授权。

## 发布与验证

先按 `deployment/README.md` 完成检查并在临时目录构建，将该实例的成品保存到
`dist/msft/`，更新生产清单并提交。`dist/main.js` 仍为主服务原件。
发布指定 commit，在 VM 上以 root 执行 `python3 deployment/msft/install.py`。
安装器从该 commit 复制 `dist/msft/`，并链接到同版本主仓库的 `node_modules`。
企业 token 和客户端 key 必须提前通过 SSH 放在安装器指定的私有文件中。

`copilot-msft.service` 的 Node 路径对应 FSD VM 的现有 Node 20.19.4。
使用前确认 Node 路径、程序、依赖和授权文件存在。将独立密钥写入私有
`service.env`，再安装该 unit。只启动新服务，使用新密钥验证本地 `/v1/models`。

安装器先备份 Nginx site，再安装 unit 并验证本地模型接口，之后才加入 Nginx
include、执行 `nginx -t` 和 reload。失败会恢复原 site 并停止新服务。
发布后还需验证公网模型接口、错误密钥返回 401，以及一次模型调用。

如果 token 被撤销，停止新实例，用相同目录重新运行 `auth` 完成网页验证，再启动。
Copilot 短期 token 的正常刷新由服务自动处理。不要用 `--verbose --show-token`
收集生产日志，不要将 `service.env` 或认证文件放进源码目录。

## 依据

- [GitHub：使用 GHE.com 账号登录 Copilot](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/configure-personal-settings/authenticate-to-ghecom)
- [VS Code Copilot：从 token 更新 API 地址](https://github.com/microsoft/vscode-copilot-chat/blob/main/src/platform/endpoint/node/domainServiceImpl.ts)
