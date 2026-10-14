# MSFT Copilot 上线回执：2026-10-14

- 部署时间：2026-10-14 06:34:42 UTC（北京时间 14:34:42）。
- 目标：FSD VM `VPN0707/vm0707new`，日本东部。
- 程序版本：`f9baad685f0ae22ef26eed9b8ef484dfb7fc60c6`。
- 成品：`dist/msft/main.js`，SHA-256 为
  `ce598bf7b5245f1fd2da7941b3a555dbca98b272cd09a0c40f5385bb9717bf7c`。
- 服务：`copilot-msft.service`，已启动并设置开机启动，监听 `127.0.0.1:4143`。
- 公网 API：`https://edge-fsd.japaneast.cloudapp.azure.com/msft/v1`。
- 企业登录账号：`taoli1`，`msft.ghe.com`，Copilot Enterprise。
- 实际上游：`https://copilot-api.msft.ghe.com`，来自 token 响应的 `endpoints.api`。
- 独立客户端密钥：本机 `%LOCALAPPDATA%\CopilotMsftProxy\client-key.txt`。
  可直接使用的客户端配置在同目录 `client-config.json`；内容不进入 Git。
- 服务私有状态：`/home/taoli1/.local/share/copilot-msft/`，目录 `0700`，
  token 和 `service.env` 为 `0600`。
- 回滚快照：`/root/copilot-msft-deployment/20261014T063442Z/`。

## 验证

- TypeScript、Lint、全部 87 项测试和临时目录构建通过。
- 本地与 VM 的 `deployment/verify.py --git` 通过，VM 同时核对实际 `/dash`。
- 新 key 请求公网 `/msft/v1/models` 返回 200、39 个模型；错误 key 返回 401。
- 将新 key 用于原主入口 `/v1/models` 返回 401，确认两实例的 key 独立。
- GPT-4.1 Chat Completions 返回 200，输出 `OK`。
- GPT-5.5 Responses SSE 返回 200，输出 `OK`，终态为 `response.completed`。
- 主服务的三个原有 `dist` 文件、实际 `/dash` 页面哈希以及
  `4141/4142/8317/8318` 的监听进程在部署前后保持一致。

认证由账号持有人在 GitHub 企业网页完成。token 经校验主机密钥的 SSH 传输，
未写入 Azure Run Command 参数。安装只启动新服务并 reload Nginx。
