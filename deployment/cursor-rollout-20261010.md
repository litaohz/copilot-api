# Cursor 上线回执：2026-10-10

- 部署时间：2026-10-10 04:25:30 UTC（北京时间 12:25:30）。
- 目标：FSD VM `VPN0707/vm0707new`。
- 运行配置来源：本仓库提交 `6c9776d30be15a78c72c2f1ccd199daa1b92f01b` 的 `deployment/cursor/`。
- 版本：CLIProxyAPIPlus `v7.3.12-1`，发行包与可执行文件 SHA-256 与 `deployment/cursor/release.json` 一致。
- 服务：`cursor-proxy.service` 为 `active/running`、`enabled`；部署回执中的 PID 为 `1428337`。
- 监听：仅 `127.0.0.1:8318`。
- 路由：Nginx 的 FSD HTTPS server 引入 `/etc/nginx/snippets/cursor-proxy.conf`，公开 `/cursor/v1/`。
- 激活动作：Nginx 配置语法检查通过后，仅启动 Cursor 并 reload Nginx。
- 独立访问密钥：本机 `%LOCALAPPDATA%\CursorProxyLab\azure-client-key.txt`；内容不进入 Git。
- 私有回滚快照：`/root/cursor-proxy-deployment/20261010T042530278554Z/`。

部署前后，Copilot `dist/main.js`、AGY 私有配置、实际提供的 `/dash` 页面
逐字节 SHA-256 一致；Nginx、AGY 和 `copilot-alt` 的主进程 PID 保持一致。
Cursor OAuth 凭据通过服务器专属 RSA 公钥封装的加密传输导入，未以明文写入
Azure Run Command 参数。服务器私有配置及认证文件权限为 `0600`，状态目录为 `0700`。

按用户要求没有再次运行模型推理、Claude Code 工具调用或测试套件，提交使用
`[skip ci]` 避免重复触发 GitHub Actions 测试。配置解析、进程监听和仓库文件清单
核对属于此次部署确认。公网模型端到端结果沿用此前本地验证，不声称此次已重新验证。

此前 Read 工具调用超时的限制仍保留，详见 [Cursor 使用说明](cursor/README.md)。
