# microsoft.ghe.com 独立 Copilot 实例

- 企业认证：`microsoft.ghe.com`，与 `msft.ghe.com` 分开授权。
- 后端：`127.0.0.1:4144`，`copilot-microsoft.service`。
- HTTPS：`https://edge-fsd.japaneast.cloudapp.azure.com/microsoft/v1`。
- 程序：`/home/taoli1/copilot-microsoft/`，来自 `dist/microsoft/`。
- 私有状态：`/home/taoli1/.local/share/copilot-microsoft/`。
- 客户端配置：本机 `~/.config/edge-proxy/microsoft.env`，格式与 `alt.env` 相同。

独立端口、API key、OAuth token 和统计，不做跨账号轮询。
模型 API 地址取自授权后返回的 `endpoints.api`，不复用 MSFT 的 token。

## 授权与安装

```sh
node main.js auth --github-host microsoft.ghe.com --data-dir /private/copilot-microsoft
```

账号持有人通过输出的官方网页完成设备授权。token 与独立随机
`sk-microsoft-` key 通过 SSH 传输到 VM 私有目录，不进入 Git 或 Azure Run Command。

按上级 `deployment/README.md` 运行类型检查、Lint、测试和临时目录构建，
更新 `dist/microsoft/` 与生产清单并提交。部署指定 commit 后，以 root 执行：

```sh
python3 deployment/microsoft/install.py \
  --token-file /private/github_token --key-file /private/client-key.txt
```

安装器仅首次安装此实例；已有服务会拒绝覆盖。它先检查 Git/清单、端口与凭据，
备份 Nginx，启动并验证本地模型接口，随后 `nginx -t`、reload 和 enable。
失败恢复 Nginx 并停止新实例。token 与 `service.env` 为 `0600`，私有目录为 `0700`。
发布后验证公网模型接口、错误 key 的 401、跨实例 key 隔离和一次实际模型请求。

## Decision API

`POST /microsoft/v1/systemone` 通过此实例凭据转发到
`https://copilot-api.microsoft.ghe.com/v1/systemone`（实际主机仍取自 token）。
行为及尚未确认的上游 schema 见 [Decision API](../systemone.md)。
