import {
  GeminiRequestError,
  translateGeminiRequest,
} from "~/lib/responses/gemini-request"
import { translateGeminiResponse } from "~/lib/responses/gemini-response"

import { postCopilotPassthrough } from "./passthrough"

/** Adapt Gemini's Chat Completions transport to the stateless Responses API. */
export async function createGeminiResponses(
  bodyText: string,
  requestHeaders?: Headers,
  signal?: AbortSignal,
): Promise<Response> {
  let request
  try {
    request = translateGeminiRequest(bodyText)
  } catch (error) {
    if (!(error instanceof GeminiRequestError)) throw error
    return Response.json(
      {
        error: {
          message: error.message,
          type: "invalid_request_error",
          param: error.param ?? null,
        },
      },
      { status: 400 },
    )
  }

  const messages = request.payload.messages as Array<{ role: string }>
  const upstream = await postCopilotPassthrough({
    path: "/chat/completions",
    body: JSON.stringify(request.payload),
    requestHeaders,
    initiator:
      (
        messages.some(
          (message) => message.role === "assistant" || message.role === "tool",
        )
      ) ?
        "agent"
      : "user",
    enableVision: bodyText.includes('"input_image"'),
    errorMessage: "Failed to create Gemini responses",
    signal,
    redirect: "error",
  })

  return translateGeminiResponse(upstream, request.context)
}
