import { afterAll, afterEach, expect, spyOn, test } from "bun:test"

import { state } from "~/lib/state"
import { stats } from "~/lib/stats"
import { server } from "~/server"

const originalState = { ...state }
const preconnect = globalThis.fetch.preconnect
const fetchSpy = spyOn(globalThis, "fetch")
afterAll(() => fetchSpy.mockRestore())

afterEach(() => {
  fetchSpy.mockReset()
  Object.assign(state, {
    apiKey: undefined,
    copilotToken: undefined,
    githubHost: undefined,
    copilotApiBaseUrl: undefined,
    rateLimitSeconds: undefined,
    lastRequestTimestamp: undefined,
    ...originalState,
  })
})

function prepare() {
  Object.assign(state, {
    apiKey: "synthetic-client",
    copilotToken: "synthetic-upstream",
    githubHost: "microsoft.ghe.com",
    copilotApiBaseUrl: "https://copilot-api.microsoft.ghe.com",
    manualApprove: false,
    paused: false,
    rateLimitSeconds: undefined,
  })
  return fetchSpy
}

test("both image generation routes preserve JSON payloads and forward to /v1/images/generations", async () => {
  const upstream = prepare()
  const body =
    '{"model":"gpt-image-2.5-flare","prompt":"cat","size":"1024x1024"}'
  upstream.mockImplementation(
    Object.assign(
      () =>
        Promise.resolve(
          new Response(
            '{"data":[{"b64_json":"aGVsbG8="}],"usage":{"input_tokens":10,"output_tokens":20,"total_tokens":30}}',
            {
              headers: {
                "content-type": "application/json",
                "x-request-id": "synthetic-image-id",
                "set-cookie": "must-not-forward",
              },
            },
          ),
        ),
      { preconnect },
    ),
  )

  for (const path of ["/images/generations", "/v1/images/generations"]) {
    const response = await server.request(path, {
      method: "POST",
      headers: {
        authorization: "Bearer synthetic-client",
        "content-type": "application/json",
      },
      body,
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("x-request-id")).toBe("synthetic-image-id")
    expect(response.headers.has("set-cookie")).toBe(false)
    expect(await response.json()).toEqual({
      data: [{ b64_json: "aGVsbG8=" }],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    })
  }

  expect(upstream).toHaveBeenCalledTimes(2)
  for (const [url, options] of upstream.mock.calls) {
    expect(url).toBe(
      "https://copilot-api.microsoft.ghe.com/v1/images/generations",
    )
    expect(Buffer.from(options?.body as Uint8Array).toString("utf8")).toBe(body)
    const headers = new Headers(options?.headers)
    expect(headers.get("authorization")).toBe("Bearer synthetic-upstream")
    expect(headers.get("content-type")).toBe("application/json")
  }
  expect(stats.recent.at(-1)?.model).toBe("gpt-image-2.5-flare")
})

test("both image edit routes preserve binary multipart bodies and boundary headers", async () => {
  const upstream = prepare()
  const boundary = "----CopilotImageEditBoundaryTest"
  const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255])
  const prefix = new TextEncoder().encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\ngpt-image-2.5-flare\r\n--${boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="ref.png"\r\nContent-Type: image/png\r\n\r\n`,
  )
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--\r\n`)
  const multipartBody = Buffer.concat([prefix, pngSignature, suffix])

  upstream.mockImplementation(
    Object.assign(
      () =>
        Promise.resolve(
          new Response('{"data":[{"b64_json":"ZWRpdGVk"}]}', {
            headers: { "content-type": "application/json" },
          }),
        ),
      { preconnect },
    ),
  )

  for (const path of ["/images/edits", "/v1/images/edits"]) {
    const response = await server.request(path, {
      method: "POST",
      headers: {
        authorization: "Bearer synthetic-client",
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"data":[{"b64_json":"ZWRpdGVk"}]}')
  }

  expect(upstream).toHaveBeenCalledTimes(2)
  for (const [url, options] of upstream.mock.calls) {
    expect(url).toBe("https://copilot-api.microsoft.ghe.com/v1/images/edits")
    expect(Buffer.from(options?.body as Uint8Array)).toEqual(multipartBody)
    const headers = new Headers(options?.headers)
    expect(headers.get("content-type")).toBe(
      `multipart/form-data; boundary=${boundary}`,
    )
  }
  expect(stats.recent.at(-1)?.model).toBe("gpt-image-2.5-flare")
})
