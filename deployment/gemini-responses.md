# Gemini 接入 Codex Responses

本机入口仍为 `http://127.0.0.1:4141/v1`。请求中的模型名以 `gemini-`
开头时，`POST /v1/responses` 自动转换为上游 `/chat/completions`，再将结果
转换回 Responses JSON 或 SSE。其他模型继续使用原有转发路径。
模型是否可用，以当前实例的 `GET /v1/models` 为准。

## 支持范围

- 文字、图片输入，以及普通文本或 JSON 格式输出。
- Function 工具、纯文本 custom 工具和 namespace 工具；工具调用、参数分片及
  工具结果支持多轮回放。
- SSE 实时增量、并行工具调用、用量统计及客户端取消。
- `reasoning.effort` 的 `low`、`medium`、`high`。

Gemini 返回的 `reasoning_opaque`、`reasoning_content` 和工具签名元数据会放入
带版本前缀的 `reasoning.encrypted_content` carrier，随历史回放后恢复到原来的
assistant 消息或工具调用。它们不作为可见正文输出；客户端必须保留这些 carrier。
切换模型时建议新建会话，避免混入其他模型的加密历史。

以下请求会明确返回 HTTP 400：`previous_response_id`、`conversation`、
`store=true`、`background=true`、服务端托管工具、custom grammar，以及其他
模型或服务生成的 encrypted reasoning。桥接使用客户端提交的完整历史，
不提供服务端会话存储。截断、内容过滤、上游错误和缺少结束标记不会被标记为成功完成。

这是协议桥接；内置 Web Search、Image Generation，以及 Codex 的全部高级工具
并未因此自动获得支持。普通 function/namespace 工具调用与这些托管能力需要分别验证。

## Codex 模型目录与使用

如果本机已设置静态 `model_catalog_json`，还需向该文件加入 Gemini 专用 metadata；
只改 `model` 不会更新模型列表。不要复制 GPT 模板后仅替换模型名：推理档位、
工具模式、指令和上下文能力必须与 Gemini 桥接匹配。

在仓库目录执行以下命令。生成器从 `COPILOT_API_KEY` 或 `OPENAI_API_KEY`
环境变量读取现有密钥，查询目标实例的可用模型，保留原有 GPT 条目，并在更新前备份目录文件。
省略最后的地址参数时使用本机默认入口；不要把密钥写入命令或仓库文件。

```powershell
bun run scripts/generate-gemini-catalog.ts "$HOME\.codex\model-catalogs\edge-fsd.json" http://127.0.0.1:4141/v1
```

确保 `~/.codex/config.toml` 的 `model_catalog_json` 指向更新后的文件，保留现有
provider、endpoint 和认证配置。重新打开 App 后新建会话选择 Gemini，或在 CLI 中执行：

```powershell
codex -m gemini-4-carbon -c 'model_reasoning_effort="low"'
```

## 验证与发布

源码变更按 [AGENTS.md](../AGENTS.md) 执行类型、Lint、测试和临时目录构建：

```powershell
bun run typecheck
bun run lint
bun test
$candidateBuild = Join-Path $env:TEMP ("copilot-api-candidate-" + [guid]::NewGuid().ToString("N"))
bun run build --out-dir "$candidateBuild"
```

这些验证不更新被 Git 跟踪的 `dist/`，也不发布到远端生产。
发布前另按 [deployment/README.md](README.md) 核对构建及部署一致性；
本机接入通过不代表远端服务已经升级。
