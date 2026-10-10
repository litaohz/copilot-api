export function bodyWithStableIds(
  upstream: Response,
  requestText: string,
  enabled?: boolean,
): ReadableStream<Uint8Array> | null
