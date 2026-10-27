# Decision / SystemOne 透传

`microsoft-decision-1` 的上游模型类型为 `decisions`，声明的端点为
`/v1/systemone`。它不使用普通 Chat Completions 或 Responses 请求转换。

代理新增 `POST /v1/systemone` 和 `POST /systemone`。每个实例使用自己的
Copilot token 与 token 响应中的 API 地址，客户端仍使用该实例原有 API key。
保留原始 UTF-8 请求正文、上游响应流、状态码、content-type、request ID 和
retry-after；401 按已有机制刷新 token 后只重试一次。
客户端 Authorization、cookie 和自定义上游认证头不透传。
沿用现有暂停、限流、手动批准及请求归属统计；不为未知 schema 推算 token 用量。
客户端取消会传到本端点的上游 fetch。

## FSD 路径

| 实例 | 公网路径 | 后端 |
| --- | --- | --- |
| 主号 | `/v1/systemone` | `4141` |
| 副号 | `/alt/v1/systemone` | `4142` |
| MSFT | `/msft/v1/systemone` | `4143` |
| Microsoft | `/microsoft/v1/systemone` | `4144` |

现有 Nginx 的 `/v1/` 和 `/alt/v1/` 规则已允许这两条路径；企业实例的独立
prefix location 同样允许。根路径别名 `/systemone` 需要相应的 Nginx 白名单。

## 请求 schema 的边界

模型出现在列表中不代表已获得有效的 Decision 调用样例。上游未在模型元数据中
公布请求 schema；标准 chat/input 字段返回 400 时，代理原样返回错误，不能据此
声称已验证决策结果。调用者应将已确认的 SystemOne JSON 原样提交：

```sh
curl "$OPENAI_BASE_URL/systemone" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @systemone-request.json
```

公开的 VS Code `RouterDecisionFetcher` 使用 `prompt`、`available_models` 等字段，
但 `@vscode/copilot-api` 0.5.2 将其 `ModelRouter` 映射到 `/models/session/intent`。
这是另一端点，不能当作 `/v1/systemone` 的已验证协议。

- [VS Code RouterDecisionFetcher](https://github.com/microsoft/vscode-copilot-chat/blob/main/src/platform/endpoint/node/routerDecisionFetcher.ts)
- [Copilot API client 0.5.2](https://www.npmjs.com/package/@vscode/copilot-api/v/0.5.2)

回归测试覆盖真实服务器路由中的鉴权、暂停、限流、原文透传、企业主机、错误/SSE
响应、敏感头隔离、取消和一次性 401 刷新。
