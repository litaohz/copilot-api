import type { ServerRequest } from "srvx"

export function clientDisconnectSignal(request: ServerRequest): AbortSignal {
  const response = request.runtime?.node?.res
  if (!response) return request.signal

  // srvx 0.8.9's Node request signal fires when the incoming body finishes.
  // The outgoing response closes early only when the client disconnects.
  const controller = new AbortController()
  response.once("close", () => {
    if (!response.writableFinished) controller.abort()
  })
  if (response.destroyed && !response.writableFinished) controller.abort()
  return controller.signal
}
