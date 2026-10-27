# Decision / SystemOne 调用与透传

`microsoft-decision-1` 的上游模型类型为 `decisions`，声明的端点为
`/v1/systemone`。它不使用普通 Chat Completions 或 Responses 请求转换。
请求格式已依据 [Microsoft 官方文档](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-microsoft-decision)
（更新于 2026-10-09）验证：`model`、`state`、`questions`。
2026-10-27 已在主号、Microsoft、MSFT、ALT 的公网 Copilot 代理上取得成功的决策结果，
不需要修改此前上线的透传代码。

代理新增 `POST /v1/systemone` 和 `POST /systemone`。每个实例使用自己的
Copilot token 与 token 响应中的 API 地址，客户端仍使用该实例原有 API key。
保留原始 UTF-8 请求正文、上游响应流、状态码、content-type、request ID 和
retry-after；401 按已有机制刷新 token 后只重试一次。
客户端 Authorization、cookie 和自定义上游认证头不透传。
沿用现有暂停、限流、手动批准及请求归属统计。响应中的 `usage` 原样返回客户端；
当前 SystemOne 端点尚未加入 dashboard 的 token 聚合扫描。
客户端取消会传到本端点的上游 fetch。
Node 运行时通过响应连接提前关闭来识别取消，避免 srvx 0.8.9 在正常读完请求正文时
触发的 request signal 造成误取消；回归测试通过真实 Node HTTP socket 验证这两种情况。

## FSD 路径

| 实例 | 公网路径 | 后端 |
| --- | --- | --- |
| 主号 | `/v1/systemone` | `4141` |
| 副号 | `/alt/v1/systemone` | `4142` |
| MSFT | `/msft/v1/systemone` | `4143` |
| Microsoft | `/microsoft/v1/systemone` | `4144` |

现有 Nginx 的 `/v1/` 和 `/alt/v1/` 规则已允许这两条路径；企业实例的独立
prefix location 同样允许。根路径别名 `/systemone` 需要相应的 Nginx 白名单。

## 请求格式

`state` 可以是文本或 JSON 对象；`questions` 是以问题名称为 key 的对象。
同一请求可包含多个问题，结果保存在同名的 `answers` 字段中。

| 问题类型 | `criteria` | 返回结果 |
| --- | --- | --- |
| `noul` | 可选的 `true` / `false` 条件对象 | `noul`：条件成立的概率，范围 0–1 |
| `choice` | 候选标签到说明的对象 | `choice`、各标签 `probabilities`，实测还包含 `confidence` |
| `score` | 从低到高的等级说明数组 | `score`、`legend`、各等级 `probabilities`，实测还包含 `confidence` |

`score` 是等级索引的概率加权平均值。例如四个等级的分数范围为 0–3，可出现小数。
概率和分数应在具体任务上验证，单次示例不代表准确率或校准质量。

最小分类示例：

```json
{
  "model": "microsoft-decision-1",
  "state": "The API returns 500 on every call.",
  "questions": {
    "team": {
      "type": "choice",
      "instructions": "Which team should handle this ticket?",
      "criteria": {
        "billing": "Charges, invoices, and refunds",
        "engineering": "Bugs, errors, and outages",
        "support": "How-to and account questions"
      }
    }
  }
}
```

Microsoft 入口实测返回 `answers.team.choice = "engineering"`，
该标签概率约 `0.99924`。完整的三种类型组合请求保存在
[`systemone-request.json`](systemone-request.json)。从仓库根目录运行：

```sh
curl "$OPENAI_BASE_URL/systemone" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H 'Content-Type: application/json' \
  --data-binary @deployment/systemone-request.json
```

Windows PowerShell 可直接使用本机已保存的配置：

```powershell
$decisionConfig = Get-Content "$env:USERPROFILE/.config/edge-proxy/microsoft.env" -Raw | ConvertFrom-StringData
Invoke-RestMethod -Method Post -Uri "$($decisionConfig.OPENAI_BASE_URL)/systemone" `
  -Headers @{ Authorization = "Bearer $($decisionConfig.OPENAI_API_KEY)" } `
  -ContentType 'application/json' -InFile deployment/systemone-request.json
```

组合请求在 Microsoft 和 MSFT 的实测结果包括：
`team = engineering`、`severity.score ≈ 2.878`（0–3）、
`repeat_contact.noul ≈ 0.99539`，`usage` 为 121 input tokens / 3 output tokens。
这些是合成样例的一次运行结果，不是性能或准确率保证。

## Foundry 与 Copilot 的调用差别

| 配置 | Azure Foundry 文档 | 当前 Copilot 代理 |
| --- | --- | --- |
| URL | `<resource>/providers/microsoft/v1/systemone` | `<代理实例 base URL>/systemone` |
| `model` | 用户创建的 deployment name | 模型列表中的 `microsoft-decision-1` |
| 认证 | Entra bearer token 或 Azure `api-key` | 实例自己的 Bearer API key 或 `x-api-key` |

Foundry 的 provider 前缀和 Azure key 不应添加到当前代理请求中。
实测响应 `model` 为 `decision-icebox-9b`；它是上游返回的内部模型标识，可能不同于
请求的别名，代理保留原值，不将其改写为请求模型。

## 协议边界与验证

普通 chat/input 正文仍会得到上游 400；正确的 `state` / `questions` 请求已返回 200。
模型不生成自由文本回答或书面解释，它返回结构化决策。
公开的 VS Code `RouterDecisionFetcher` 使用 `prompt`、`available_models` 等字段，
但 `@vscode/copilot-api` 0.5.2 将其 `ModelRouter` 映射到 `/models/session/intent`。
这是另一端点，不能当作 `/v1/systemone` 的已验证协议。

- [VS Code RouterDecisionFetcher](https://github.com/microsoft/vscode-copilot-chat/blob/main/src/platform/endpoint/node/routerDecisionFetcher.ts)
- [Copilot API client 0.5.2](https://www.npmjs.com/package/@vscode/copilot-api/v/0.5.2)

回归测试覆盖真实服务器路由中的鉴权、暂停、限流、原文透传、企业主机、错误/SSE
响应、敏感头隔离、取消和一次性 401 刷新。
