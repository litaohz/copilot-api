import { stabilizeResponseStream } from './stable-ids.mjs';

// Only this known-broken model and wire format are changed. No retries.
export function bodyWithStableIds(upstream, requestText, enabled = true) {
  if (!enabled || upstream.status !== 200 || !upstream.body ||
      !upstream.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
    return upstream.body;
  }
  let payload;
  try { payload = JSON.parse(requestText); }
  catch { return upstream.body; } // Preserve the original upstream error/protocol behavior.
  if (payload?.model !== 'gpt-6-astra' || payload?.stream !== true) return upstream.body;
  return stabilizeResponseStream(upstream.body);
}
