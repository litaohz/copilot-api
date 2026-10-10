const knownTypes = new Set([
  'created', 'queued', 'in_progress', 'completed', 'failed', 'incomplete',
  'output_item.added', 'output_item.done', 'content_part.added', 'content_part.done',
  'output_text.delta', 'output_text.done', 'output_text.annotation.added',
  'refusal.delta', 'refusal.done', 'function_call_arguments.delta', 'function_call_arguments.done',
  'reasoning_summary_part.added', 'reasoning_summary_part.done',
  'reasoning_summary_text.delta', 'reasoning_summary_text.done', 'reasoning_text.delta', 'reasoning_text.done',
  'custom_tool_call_input.delta', 'custom_tool_call_input.done',
  'file_search_call.in_progress', 'file_search_call.searching', 'file_search_call.completed',
  'web_search_call.in_progress', 'web_search_call.searching', 'web_search_call.completed',
  'code_interpreter_call.in_progress', 'code_interpreter_call.interpreting', 'code_interpreter_call.completed',
  'code_interpreter_call_code.delta', 'code_interpreter_call_code.done',
  'image_generation_call.in_progress', 'image_generation_call.generating', 'image_generation_call.completed', 'image_generation_call.partial_image',
  'mcp_call_arguments.delta', 'mcp_call_arguments.done', 'mcp_call.in_progress', 'mcp_call.completed', 'mcp_call.failed',
  'mcp_list_tools.in_progress', 'mcp_list_tools.completed', 'mcp_list_tools.failed',
  'audio.delta', 'audio.done', 'audio_transcript.delta', 'audio_transcript.done'
].map(type => `response.${type}`));

/**
 * Stabilize one request's OpenAI Responses SSE body without retries or completion synthesis.
 * Only non-empty, observed string IDs are canonicalized. Unknown event types pass through.
 *
 * Frames use LF/CRLF; the final unterminated frame is forwarded literally on clean EOF.
 * Buffers at most the current incomplete frame plus native stream queues, not the response.
 * Input/output byte equality is preserved unless an allowed ID token actually changes.
 * Chunk boundaries may change. pipeThrough retains native cancellation/error/backpressure.
 *
 * @param {ReadableStream<Uint8Array>} body
 * @returns {ReadableStream<Uint8Array>}
 */
export function stabilizeResponseStream(body) {
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const encoder = new TextEncoder();
  let parts = [];
  let byteLength = 0;
  let lineLength = 0;
  let previousByte;
  let firstFrame = true;
  let responseId;
  const items = new Map();
  function rewrite(frame) {
    const lines = frame.match(/[^\n]*\n/g) ?? [];
    const dataLines = [];
    lines.forEach((line, index) => {
      const match = /^data:( ?)([\s\S]*?)(\r?\n)$/.exec(line);
      if (match) dataLines.push({ index, value: match[2], prefix: `data:${match[1]}`, eol: match[3] });
    });
    let event;
    try { event = JSON.parse(dataLines.map(x => x.value).join('\n')); } catch { return frame; }
    if (!event || typeof event !== 'object' || Array.isArray(event)) return frame;
    const eventName = lines.filter(line => line.startsWith('event:')).at(-1)?.replace(/^event: ?/, '').replace(/\r?\n$/, '');
    const type = event.type ?? eventName;
    if (!knownTypes.has(type) || (eventName && eventName !== 'message' && eventName !== type)) return frame;
    const data = dataLines.map(x => x.value).join('\n');
    const replacements = [];
    // JSON is validated above. Walk its lexical structure, not user strings;
    // replacing only ID string tokens avoids lossy number/string reserialization.
    const stack = [];
    for (const token of data.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g)) {
      const text = token[0];
      const parent = stack.at(-1);
      if (text === ':' ) continue;
      if (text === ',') { if (parent?.kind === 'object') parent.keyNext = true; continue; }
      if (text === '}' || text === ']') { stack.pop(); continue; }
      if (parent?.kind === 'object' && parent.keyNext) {
        parent.key = JSON.parse(text);
        parent.keyNext = false;
        continue;
      }
      const path = parent ? (parent.path === null ? null : [...parent.path, parent.kind === 'object' ? parent.key : parent.index++]) : [];
      if (text === '{' || text === '[') {
        stack.push({ kind: text === '{' ? 'object' : 'array', path: path && path.length <= 4 ? path : null, keyNext: text === '{', index: 0 });
        continue;
      }
      if (!path || text[0] !== '"') continue;
      const value = JSON.parse(text);
      if (!value) continue;
      let canonical;
      if ((path.length === 1 && path[0] === 'response_id') || (path.length === 2 && path[0] === 'response' && path[1] === 'id')) {
        responseId ??= value;
        canonical = responseId;
      } else {
        let index;
        if (Number.isSafeInteger(event.output_index) && event.output_index >= 0 && (
          (path.length === 1 && path[0] === 'item_id') ||
          (path.length === 2 && path[0] === 'item' && path[1] === 'id' && (type === 'response.output_item.added' || type === 'response.output_item.done'))
        )) index = event.output_index;
        if (path.length === 4 && path[0] === 'response' && path[1] === 'output' && typeof path[2] === 'number' && path[3] === 'id') index = path[2];
        if (index === undefined) continue;
        if (!items.has(index)) items.set(index, value);
        canonical = items.get(index);
      }
      if (value !== canonical) replacements.push({ start: token.index, end: token.index + text.length, value: JSON.stringify(canonical) });
    }
    if (!replacements.length) return frame;
    let rewritten = data;
    for (const edit of replacements.reverse()) rewritten = rewritten.slice(0, edit.start) + edit.value + rewritten.slice(edit.end);
    const values = rewritten.split('\n');
    for (const [i, line] of dataLines.entries()) lines[line.index] = `${line.prefix}${values[i]}${line.eol}`;
    return lines.join('');
  }
  function append(part) {
    if (!part.length) return;
    parts.push(part);
    byteLength += part.length;
  }
  function takeFrame() {
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    parts = [];
    byteLength = 0;
    return bytes;
  }
  function emit(controller) {
    const bytes = takeFrame();
    const isFirst = firstFrame;
    firstFrame = false;
    let text;
    try { text = decoder.decode(bytes); } catch { controller.enqueue(bytes); return; }
    const bom = isFirst && text.startsWith('\ufeff') ? '\ufeff' : '';
    const rewritten = bom + rewrite(text.slice(bom.length));
    controller.enqueue(rewritten === text ? bytes : encoder.encode(rewritten));
  }
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      let start = 0;
      // Byte-level framing is UTF-8 safe and scans fragmented frames only once.
      for (let i = 0; i < chunk.length; i++) {
        const byte = chunk[i];
        if (byte === 10) {
          const blank = lineLength === 0 || (lineLength === 1 && previousByte === 13);
          lineLength = 0;
          if (blank) {
            append(chunk.subarray(start, i + 1));
            emit(controller);
            start = i + 1;
          }
        } else lineLength++;
        previousByte = byte;
      }
      // Own pending bytes across pulls, including Buffer views.
      append(new Uint8Array(chunk.subarray(start)));
    },
    flush(controller) {
      // An unterminated final frame is not a dispatched SSE event. Pass it on
      // literally; never synthesize a delimiter, completion, DONE, or retry.
      if (byteLength) controller.enqueue(takeFrame());
    }
  }));
}
