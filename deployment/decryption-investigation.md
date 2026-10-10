# 加密代理消息故障：对照结果与修复范围

调查日期：2026-10-10。目标模型 `gpt-6-astra`，主 FSD 通道。

## 结论

对已失败样本，绕过 FSD、直连同一 Copilot 上游、使用 FSD 当前上游 token，仍得到 `invalid_request_body` / `Encrypted function output content could not be decrypted or decoded.`。相同请求正文的 SHA-256 一致；普通文本在两条链路均成功。该对照排除了 FSD 的响应 ID 适配器和 Nginx 是此样本解密拒绝的必要原因，不证明整个上游永久不支持子代理。

父代理工具调用参数中的密文，与子代理 `agent_message` 中密文的 SHA-256 完全一致，未发现中间改写。昨日成功样本的旧密文现在也失败；新生成的普通 reasoning 加密项能成功回传。因此可能涉及加密代理消息的兼容性、密文有效期或上游密钥/上下文状态。现有证据不能区分这些原因，不能宣称已经定位密钥轮换。

## 实际最小对照

| 输入与路径 | 结果 |
| --- | --- |
| 普通文本 → FSD | HTTP 200，response.completed |
| 相同普通文本 → Copilot 直连 | HTTP 200，response.completed |
| 一条失败 agent_message → FSD | HTTP 200，response.failed 后跟 invalid_request_body error |
| 相同失败 agent_message → Copilot 直连 | 相同终态事件与解密错误 |
| 合成明文 agent_message → Copilot 直连 | 成功 |
| 失败密文，X-Initiator 改 agent | 相同解密错误 |
| 失败密文，补原会话 ID 与 turn ID 头 | 相同解密错误 |
| 失败密文，非流式 | HTTP 400，原始 invalid_request_body |
| 昨日成功过的旧代理密文，今天直连重放 | 解密错误 |
| 今日新生成 reasoning 加密项，保留完整输出再回传 | 两次 HTTP 200，均 completed |

所有重放均为有限最小诊断，无工具执行，不回放完整私有对话。原始密文与凭据没有进入仓库。直连沿用线上生成头的约定；VSCode 版本使用代码默认值 1.104.3，未从运行进程证实其实际缓存值。这是对照限制，普通文本对照可工作。

## 我们能修的错误处理

真实流顺序是：

```text
response.created
response.failed  (response.error 为空)
error            (code=invalid_request_body, message=具体解密错误)
```

客户端在 `response.failed` 就结束解析并按断流重试，错过后面的原因。该错误本质上是请求被拒绝；对应非流式路径返回 HTTP 400。

`normalizeEarlyResponseFailure` 在响应刚开始时进行最多 500 ms、64 KiB 的前缀检查。仅在生成开始前看到明确 `invalid_request_body` 时，把它还原成 HTTP 400 + 结构化错误，保留上游 request ID。看到 in_progress、输出、未知事件、达到截止时间或大小上限，立即把已读字节及后续流原样交还。没有删除、替换或尝试解密请求正文，没有透明重试。

真实接口候选验证：普通流正常完成；失败样本变为 HTTP 400，解析前缀分别耗时约 13 ms / 6 ms。单元测试覆盖分块、超时未完成读取、正常流、生成后失败、取消、大小限制与非 SSE。失败细节晚于检查窗口或在生成开始后出现时仍保留原流，不承诺覆盖所有 SSE 故障。

HTTP 非成功响应也保留上游 `error.code/type/message` 与 `x-request-id`，不再把整个 JSON 嵌成字符串。早期解密失败因此能被原有 HTTP 状态统计记作 400；其他生成后失败的完整终态统计、统计 tee 分支取消传播和权限隔离仍是独立问题。

## 后续所需证据

需要一个新生成的最小原生子代理任务，避免旧密文有效性的混淆；当前规则要求用户明确授权才能启动该诊断子代理。未执行前，不声称新子代理可用或不可用。

如果新样本也被上游拒绝，可向上游提供请求 ID、错误码、模型、时间及不含正文的结构摘要，定位加密代理消息的解码。代理没有上游解密密钥，不能自行恢复已不可解的任务正文；不能通过删除密文制造“成功”。可行的工作流替代是经明确选择，使用可读任务交接，但这不是本次自动修改的一部分。

官方参考：[Reasoning models — Preserve reasoning without stored responses](https://developers.openai.com/api/docs/guides/reasoning#preserve-reasoning-without-stored-responses) 要求保留完整输出及加密项。该文档描述 reasoning，不足以证明 Copilot 的私有 agent_message 解码契约。

## copilot-llm-bridge 参考对照

已检查用户克隆的 `ai-microsoft/copilot-llm-bridge`，提交 `9fad2701ba79b8b0abd91e5deebc26087ecfe770`。其原生 Responses 路径同样保持上游 item ID 的首次值；7 项 stream identity 单测通过。没有 agent_message 解密实现或真实加密子代理修复证据，不能据此声称换成 LiteLLM 就能解决。

其差异是从 token 响应读取 `endpoints.api`，并过滤不支持的 service_tier 和 hosted tools。已向当前账号 token 服务核对，返回 `https://api.enterprise.githubcopilot.com`；同一个失败样本在 enterprise 地址仍返回相同解密错误，普通文本成功。最小失败样本没有 service_tier 或 tools，所以这两项过滤不能解释该样本。

`X-Interaction-ID` 与 initiator 推导写在该项目的 Chat Completions 路径，不应误认为原生 Responses 路径已经应用了同样逻辑。其 Responses 头来自 LiteLLM 的 Copilot 默认头并叠加额外头；尚未对整个 LiteLLM 容器做真实子代理对照，保留这个证据边界。
