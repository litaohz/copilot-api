import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"

import consola from "consola"

export class HTTPError extends Error {
  response: Response

  constructor(message: string, response: Response) {
    super(message)
    this.response = response
  }
}

export async function forwardError(c: Context, error: unknown) {
  consola.error("Error occurred:", error)

  if (error instanceof HTTPError) {
    const errorText = await error.response.text()
    let errorJson: unknown
    try {
      errorJson = JSON.parse(errorText)
    } catch {
      errorJson = errorText
    }
    consola.error("HTTP error:", errorJson)
    const hasStructuredError =
      typeof errorJson === "object"
      && errorJson !== null
      && "error" in errorJson
      && typeof errorJson.error === "object"
      && errorJson.error !== null
    const requestId = error.response.headers.get("x-request-id")
    if (requestId) c.header("x-request-id", requestId)
    return c.json(
      hasStructuredError ? errorJson : (
        {
          error: {
            message: errorText,
            type: "error",
          },
        }
      ),
      error.response.status as ContentfulStatusCode,
    )
  }

  return c.json(
    {
      error: {
        message: (error as Error).message,
        type: "error",
      },
    },
    500,
  )
}
