import { expect, test } from "bun:test"

import {
  decodeGeminiToolMetadata,
  encodeGeminiMessageMetadata,
  encodeGeminiToolMetadata,
} from "~/lib/responses/gemini-metadata"
import {
  GeminiRequestError,
  translateGeminiRequest,
} from "~/lib/responses/gemini-request"

function translate(input: Record<string, unknown>) {
  return translateGeminiRequest(
    JSON.stringify({ model: "gemini-4-carbon", ...input }),
  )
}

const emptyTools = [
  undefined,
  [],
  [{ type: "namespace", name: "empty", tools: [] }],
]

test("tool-free Codex requests omit choices that do not require a tool", () => {
  for (const tools of emptyTools) {
    for (const toolChoice of [undefined, null, "auto", "none"]) {
      for (const stream of [false, true]) {
        const { payload } = translate({
          input: "Hello",
          tools,
          tool_choice: toolChoice,
          parallel_tool_calls: true,
          stream,
        })
        expect(payload).not.toHaveProperty("tools")
        expect(payload).not.toHaveProperty("tool_choice")
        expect(payload).not.toHaveProperty("parallel_tool_calls")
        expect(payload.stream).toBe(stream)
      }
    }
  }
})

test("tool-free requests cannot require or force an undeclared tool", () => {
  for (const tools of emptyTools) {
    for (const toolChoice of [
      "required",
      { type: "function", name: "lookup" },
      { type: "custom", name: "lookup" },
    ]) {
      expect(() =>
        translate({ input: "Hello", tools, tool_choice: toolChoice }),
      ).toThrow(GeminiRequestError)
    }
  }
})

test("declared tools preserve automatic, disabled and required choices", () => {
  const declarations = [
    [{ type: "function", name: "lookup" }],
    [{ type: "custom", name: "lookup" }],
    [
      {
        type: "namespace",
        name: "local",
        tools: [{ type: "function", name: "lookup" }],
      },
    ],
  ]
  for (const tools of declarations) {
    for (const toolChoice of ["auto", "none", "required"]) {
      const { payload } = translate({
        input: "Hello",
        tools,
        tool_choice: toolChoice,
        parallel_tool_calls: false,
      })
      expect(payload.tools).toHaveLength(1)
      expect(payload.tool_choice).toBe(toolChoice)
      expect(payload.parallel_tool_calls).toBe(false)
    }
  }
})

test("history cannot declare a forced tool for the current request", () => {
  const input = [
    {
      type: "function_call",
      name: "old_tool",
      call_id: "old-call",
      arguments: "{}",
    },
    { type: "function_call_output", call_id: "old-call", output: "Done" },
    { role: "user", content: "Continue." },
  ]
  for (const tools of [[], [{ type: "function", name: "active_tool" }]]) {
    expect(() =>
      translate({
        input,
        tools,
        tool_choice: { type: "function", name: "old_tool" },
      }),
    ).toThrow("declared tool")
  }
})

test("maps developer instructions, images and JSON output without changing their meaning", () => {
  const { payload, context } = translate({
    instructions: "Be concise.",
    input: [
      {
        role: "developer",
        content: [{ type: "input_text", text: "Use the supplied picture." }],
      },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Read this" },
          {
            type: "input_image",
            image_url: "data:image/png;base64,AAAA",
            detail: "high",
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "answer",
        schema: { type: "object", properties: { text: { type: "string" } } },
        strict: true,
      },
    },
    max_output_tokens: 128,
    reasoning: { effort: "low", summary: "auto" },
    metadata: { trace: "request-1" },
    stream: true,
    store: false,
    include: ["reasoning.encrypted_content"],
  })
  expect(payload.messages).toEqual([
    { role: "system", content: "Be concise." },
    { role: "system", content: "Use the supplied picture." },
    {
      role: "user",
      content: [
        { type: "text", text: "Read this" },
        {
          type: "image_url",
          image_url: { url: "data:image/png;base64,AAAA", detail: "high" },
        },
      ],
    },
  ])
  expect(payload.max_tokens).toBe(128)
  expect(payload.reasoning_effort).toBe("low")
  expect(payload.stream_options).toEqual({ include_usage: true })
  expect(payload.response_format).toMatchObject({
    type: "json_schema",
    json_schema: { name: "answer", strict: true },
  })
  expect(context.responseFields.metadata).toEqual({ trace: "request-1" })
})

test("keeps parallel function calls in one assistant turn and binds both tool results", () => {
  const { payload } = translate({
    tools: [
      {
        type: "function",
        name: "lookup",
        parameters: { type: "object", properties: { key: { type: "string" } } },
      },
    ],
    input: [
      { role: "user", content: "Read a and b." },
      {
        type: "function_call",
        call_id: "call-a",
        name: "lookup",
        arguments: '{"key":"a"}',
      },
      {
        type: "function_call",
        call_id: "call-b",
        name: "lookup",
        arguments: '{"key":"b"}',
      },
      { type: "function_call_output", call_id: "call-a", output: "A" },
      {
        type: "function_call_output",
        call_id: "call-b",
        output: [{ type: "input_text", text: "B" }],
      },
    ],
    tool_choice: { type: "function", name: "lookup" },
  })
  expect(payload.messages).toEqual([
    { role: "user", content: "Read a and b." },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call-a",
          type: "function",
          function: { name: "lookup", arguments: '{"key":"a"}' },
        },
        {
          id: "call-b",
          type: "function",
          function: { name: "lookup", arguments: '{"key":"b"}' },
        },
      ],
    },
    { role: "tool", tool_call_id: "call-a", content: "A" },
    { role: "tool", tool_call_id: "call-b", content: "B" },
  ])
  expect(payload.tool_choice).toEqual({
    type: "function",
    function: { name: "lookup" },
  })
})

test("flattens namespaces without colliding and wraps raw custom-tool input", () => {
  const tools = [
    { type: "function", name: "run" },
    {
      type: "namespace",
      name: "shell",
      tools: [{ type: "function", name: "run" }],
    },
    { type: "custom", name: "apply_patch", format: { type: "text" } },
  ]
  const { payload, context } = translate({
    tools,
    input: [
      {
        type: "custom_tool_call",
        call_id: "patch-1",
        name: "apply_patch",
        input: "*** Begin Patch\n*** End Patch",
      },
      { type: "custom_tool_call_output", call_id: "patch-1", output: "Done" },
    ],
  })
  const names = Object.keys(context.tools)
  expect(new Set(names).size).toBe(3)
  expect(context.tools.run).toEqual({ type: "function", name: "run" })
  expect(Object.values(context.tools)).toContainEqual({
    type: "function",
    name: "run",
    namespace: "shell",
  })
  const customName = names.find((name) => context.tools[name].type === "custom")
  expect(customName).toBeDefined()
  expect(payload.messages).toMatchObject([
    {
      tool_calls: [
        {
          function: {
            name: customName,
            arguments: JSON.stringify({
              input: "*** Begin Patch\n*** End Patch",
            }),
          },
        },
      ],
    },
    { role: "tool", tool_call_id: "patch-1" },
  ])
})

test("round-trips both message-level opaque reasoning and tool thought signatures", () => {
  const toolMetadata = encodeGeminiToolMetadata("gemini-4-carbon", "call-1", {
    id: "call-1",
    type: "function",
    extra_content: { google: { thought_signature: "signature" } },
    function: {
      name: "lookup",
      arguments: "{}",
      thoughtSignature: "function-signature",
    },
  })
  const messageMetadata = encodeGeminiMessageMetadata(
    "gemini-4-carbon",
    ["call-1"],
    { reasoning_opaque: "opaque-reasoning" },
  )
  const { payload } = translate({
    input: [
      {
        type: "function_call",
        name: "lookup",
        call_id: "call-1",
        arguments: "{}",
      },
      { type: "reasoning", encrypted_content: toolMetadata, summary: [] },
      { type: "reasoning", encrypted_content: messageMetadata, summary: [] },
      { type: "function_call_output", call_id: "call-1", output: "result" },
    ],
  })
  expect(payload.messages).toMatchObject([
    {
      role: "assistant",
      reasoning_opaque: "opaque-reasoning",
      tool_calls: [
        {
          id: "call-1",
          extra_content: { google: { thought_signature: "signature" } },
          function: {
            name: "lookup",
            arguments: "{}",
            thoughtSignature: "function-signature",
          },
        },
      ],
    },
    { role: "tool", tool_call_id: "call-1", content: "result" },
  ])
})

test("binds pure-text opaque reasoning to its original assistant item", () => {
  const metadata = encodeGeminiMessageMetadata(
    "gemini-4-carbon",
    [],
    { reasoning_opaque: "opaque" },
    "msg-1",
  )
  const { payload } = translate({
    input: [
      {
        type: "message",
        role: "assistant",
        id: "msg-1",
        content: [{ type: "output_text", text: "Earlier answer" }],
      },
      { type: "reasoning", encrypted_content: metadata, summary: [] },
      { role: "user", content: "Continue" },
    ],
  })
  expect(payload.messages).toEqual([
    {
      role: "assistant",
      content: "Earlier answer",
      reasoning_opaque: "opaque",
    },
    { role: "user", content: "Continue" },
  ])
})

test("reassembles one assistant turn when Responses text follows its function call", () => {
  const metadata = encodeGeminiMessageMetadata(
    "gemini-4-carbon",
    ["call-1"],
    { reasoning_opaque: "opaque" },
    "msg-1",
  )
  const { payload } = translate({
    input: [
      {
        type: "function_call",
        call_id: "call-1",
        name: "lookup",
        arguments: "{}",
      },
      {
        type: "message",
        id: "msg-1",
        role: "assistant",
        content: [{ type: "output_text", text: "Checking." }],
      },
      { type: "reasoning", encrypted_content: metadata, summary: [] },
      { type: "function_call_output", call_id: "call-1", output: "Done" },
    ],
  })
  expect(payload.messages).toMatchObject([
    {
      role: "assistant",
      content: "Checking.",
      reasoning_opaque: "opaque",
      tool_calls: [{ id: "call-1" }],
    },
    { role: "tool", tool_call_id: "call-1" },
  ])
})

test("metadata cannot overwrite assistant role or mutate object prototypes", () => {
  for (const fields of [
    { role: "system" },
    JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>,
  ]) {
    const encoded =
      "gemini_bridge_v1."
      + Buffer.from(
        JSON.stringify({
          kind: "message",
          model: "gemini-4-carbon",
          callIds: [],
          messageId: "msg-1",
          fields,
        }),
      ).toString("base64url")
    expect(() => decodeGeminiToolMetadata(encoded, "gemini-4-carbon")).toThrow(
      "invalid fields",
    )
  }
})

test("does not invent a default Gemini reasoning effort", () => {
  expect(translate({ input: "Hello" }).payload).not.toHaveProperty(
    "reasoning_effort",
  )
  for (const effort of ["low", "medium", "high"])
    expect(
      translate({ input: "Hello", reasoning: { effort } }).payload
        .reasoning_effort,
    ).toBe(effort)
  for (const effort of ["none", "minimal", "xhigh", "max", "ultra"]) {
    expect(() => translate({ input: "Hello", reasoning: { effort } })).toThrow(
      "must be low, medium, or high",
    )
  }
})

const unsupportedCases: Array<[string, Record<string, unknown>]> = [
  [
    "server-side previous response",
    { input: "Hi", previous_response_id: "resp-old" },
  ],
  [
    "encrypted foreign model reasoning",
    {
      input: [
        { type: "reasoning", encrypted_content: "foreign-encrypted-content" },
      ],
    },
  ],
  ["item references", { input: [{ type: "item_reference", id: "msg-old" }] }],
  [
    "file input",
    {
      input: [
        { role: "user", content: [{ type: "input_file", file_id: "file-1" }] },
      ],
    },
  ],
  [
    "orphaned tool output",
    {
      input: [
        { type: "function_call_output", call_id: "missing", output: "done" },
      ],
    },
  ],
  ["hosted tools", { input: "Hello", tools: [{ type: "web_search" }] }],
  [
    "custom grammar",
    {
      input: "Hello",
      tools: [
        {
          type: "custom",
          name: "patch",
          format: {
            type: "grammar",
            syntax: "lark",
            definition: "start: /.+/",
          },
        },
      ],
    },
  ],
  ["background jobs", { input: "Hello", background: true }],
  ["ambiguous invalid stream", { input: "Hello", stream: "true" }],
  ["unknown request semantics", { input: "Hello", context_management: [] }],
]

test.each(unsupportedCases)(
  "rejects %s instead of silently changing its semantics",
  (_name, input) => {
    expect(() => translate(input)).toThrow(GeminiRequestError)
  },
)

test("refuses metadata from another model and dangling carrier bindings", () => {
  const metadata = encodeGeminiMessageMetadata("gemini-3.8-flash", ["call-1"], {
    reasoning_opaque: "opaque",
  })
  expect(() =>
    translate({ input: [{ type: "reasoning", encrypted_content: metadata }] }),
  ).toThrow("model mismatch")
  const dangling = encodeGeminiMessageMetadata("gemini-4-carbon", ["call-1"], {
    reasoning_opaque: "opaque",
  })
  expect(() =>
    translate({
      input: [
        { role: "user", content: "Hi" },
        { type: "reasoning", encrypted_content: dangling },
      ],
    }),
  ).toThrow("without its assistant")
  expect(
    decodeGeminiToolMetadata("opaque-from-another-backend", "gemini-4-carbon"),
  ).toBeUndefined()
})
