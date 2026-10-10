import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { stabilizeResponseStream } from '../../src/lib/responses/stable-ids.mjs';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const fixtures = ['astra.sse', 'upstream-astra.sse'];

test('raw Unicode line/paragraph separators inside JSON are not SSE line boundaries', async () => {
  const first = frame({ type: 'response.created', response: { id: 'R\u2028\u2029', output: [] }, text: 'x\u2028y\u2029z' });
  const last = frame({ type: 'response.completed', response: { id: 'bad', output: [] }, text: 'x\u2028y\u2029z' });
  const output = events(await transform(Buffer.from(first + last), 1));
  assert.equal(output[1].response.id, 'R\u2028\u2029');
  assert.equal(output[1].text, 'x\u2028y\u2029z');
});

test('deterministic randomized multi-item streams match an independent expected-byte oracle', async () => {
  let seed = 0x5eed1234;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let run = 0; run < 80; run++) {
    const ids = [`m-${run}-汉字🙂`, `f-${run}-\\\"`, `r-${run}-\ud800`];
    const responseId = `R-${run}-\n\t\\`;
    const secret = { id: 'leave', nested: [{ item_id: 'leave', response: { id: 'leave' } }], arguments: '{"id":"leave"}', encrypted_content: 'leave', call_id: 'leave' };
    const before = [{ type: 'response.created', response: { id: responseId, output: [] } }];
    const expected = structuredClone(before);
    // Interleaving shuffled by deterministic choice; canonical introductions stay unambiguous.
    const remaining = [0, 1, 2];
    while (remaining.length) {
      const index = remaining.splice(random(remaining.length), 1)[0];
      const event = { type: 'response.output_item.added', output_index: index, item: { ...secret, id: ids[index], type: ['message', 'function_call', 'reasoning'][index] } };
      before.push(event); expected.push(structuredClone(event));
    }
    for (let i = 0; i < 12; i++) {
      const index = random(3);
      const event = { type: ['response.output_text.delta', 'response.function_call_arguments.delta', 'response.reasoning_summary_text.delta'][index], output_index: index, item_id: `bad-${i}`, response_id: `bad-R-${i}`, delta: `汉字🙂\\\" ${i}`, metadata: secret };
      before.push(event);
      expected.push({ ...event, item_id: ids[index], response_id: responseId });
    }
    const final = { type: 'response.completed', response: { id: 'bad-R-end', output: ids.map((_, index) => ({ ...secret, id: `bad-item-${index}`, content: [secret] })) } };
    before.push(final);
    const fixed = structuredClone(final);
    fixed.response.id = responseId;
    fixed.response.output.forEach((item, index) => { item.id = ids[index]; });
    expected.push(fixed);
    const eol = random(2) ? '\n' : '\r\n';
    const encodeEvent = value => `: comment${eol}event: ${value.type}${eol}` + JSON.stringify(value, null, 2).split('\n').map(line => `data: ${line}${eol}`).join('') + eol;
    assert.deepEqual(await transform(Buffer.from(before.map(encodeEvent).join('')), 1 + random(129)), Buffer.from(expected.map(encodeEvent).join('')), `seeded run=${run}`);
  }
});

test('large Unicode/tool argument frame and a burst of frames are processed without data corruption', async () => {
  const payload = '汉字🙂{"id":"not-an-id-field"}\\'.repeat(6000);
  const first = frame({ type: 'response.output_item.added', output_index: 4, item: { id: 'call', type: 'function_call', call_id: 'do-not-rewrite' } });
  const delta = frame({ type: 'response.function_call_arguments.delta', output_index: 4, item_id: 'bad', delta: payload, call_id: 'do-not-rewrite' }, '\r\n');
  const input = Buffer.from(first + delta + ': heartbeat\n\n'.repeat(500));
  const expected = Buffer.from(first + delta.replace('"item_id":"bad"', '"item_id":"call"') + ': heartbeat\n\n'.repeat(500));
  for (const size of [37, input.length]) assert.deepEqual(await transform(input, size), expected);
});

test('array/object impostors and deeply nested IDs are not treated as schema ID paths', async () => {
  let nested = { id: 'nested', response_id: 'nested', item_id: 'nested' };
  for (let i = 0; i < 40; i++) nested = { array: [nested], response: { id: 'nested' } };
  const raw = frame({ type: 'response.created', response: { id: 'R', output: [{ id: 'm' }] } })
    + frame({ type: 'response.completed', response: { id: 'bad', output: { 0: { id: 'not-array' } } }, item_id: 'no-index', metadata: nested });
  const output = events(await transform(Buffer.from(raw), 11));
  assert.equal(output[1].response.id, 'R');
  assert.equal(output[1].response.output[0].id, 'not-array');
  assert.equal(output[1].item_id, 'no-index');
  assert.deepEqual(output[1].metadata, nested);
});

test('stream errors before any frame remain errors without an emitted event', async () => {
  const failure = new Error('early upstream failure');
  const input = new ReadableStream({ start(c) { c.error(failure); } });
  await assert.rejects(collect(stabilizeResponseStream(input)), e => e === failure);
});

// Independent semantic oracle: remove only the explicitly allowed ID fields.
function withoutAllowedIds(value) {
  const result = structuredClone(value);
  delete result.response_id;
  if (result.response && typeof result.response === 'object') {
    delete result.response.id;
    if (Array.isArray(result.response.output)) for (const item of result.response.output) if (item && typeof item === 'object') delete item.id;
  }
  if (Number.isSafeInteger(result.output_index) && result.output_index >= 0) {
    delete result.item_id;
    if (['response.output_item.added', 'response.output_item.done'].includes(result.type) && result.item) delete result.item.id;
  }
  return result;
}

for (const name of fixtures) for (const chunkSize of [1, 2, 3, 7, 64, 1024, 65536]) {
  test(`real ${name}: all non-ID semantics invariant, chunk=${chunkSize}`, async () => {
    const before = events(await fixture(name));
    const after = events(await transform(await fixture(name), chunkSize));
    assert.deepEqual(after.map(withoutAllowedIds), before.map(withoutAllowedIds));
    assert.deepEqual(await transform(await transform(await fixture(name), chunkSize), chunkSize), await transform(await fixture(name), chunkSize), 'idempotent');
  });
}

test('tool calls, reasoning and interleaved messages use distinct first-observed IDs, preserving opaque data', async () => {
  const opaque = { id: 'nested-id', item_id: 'nested-item', response_id: 'nested-response', call_id: 'call-unchanged', arguments: '{"id":"tool-user-id","x":"汉字🙂"}', encrypted_content: 'opaque+/==', metadata: { id: 'deep' } };
  const input = [
    { type: 'response.created', response: { id: 'R', output: [] } },
    { type: 'response.reasoning_text.delta', output_index: 1, item_id: 'reason-first', delta: 'thinking', metadata: opaque },
    { type: 'response.output_item.added', output_index: 2, item: { ...opaque, id: 'call-first', type: 'function_call' } },
    { type: 'response.output_item.added', output_index: 0, item: { ...opaque, id: 'message-first', type: 'message' } },
    { type: 'response.output_item.added', output_index: 1, item: { ...opaque, id: 'reason-later', type: 'reasoning' } },
    { type: 'response.output_text.delta', output_index: 0, item_id: 'message-later', delta: 'message-first R {"id":"x"} 汉字🙂', metadata: opaque },
    { type: 'response.function_call_arguments.delta', output_index: 2, item_id: 'call-later', call_id: 'call-unchanged', delta: opaque.arguments },
    { type: 'response.output_item.added', output_index: 3, item: { ...opaque, id: 'message-2-first', type: 'message' } },
    { type: 'response.in_progress', response: { id: 'R2', output: [0, 1, 2, 3].map(i => ({ ...opaque, id: `snapshot-${i}` })) } },
    { type: 'response.function_call_arguments.done', output_index: 2, item_id: 'call-done', ...opaque },
    { type: 'response.output_item.done', output_index: 3, item: { ...opaque, id: 'message-2-done', type: 'message' } },
    { type: 'response.completed', response: { id: 'R3', output: [0, 1, 2, 3].map(i => ({ ...opaque, id: `final-${i}` })) } }
  ];
  const canonical = ['message-first', 'reason-first', 'call-first', 'message-2-first'];
  const output = events(await transform(Buffer.from(input.map(x => frame(x)).join('')), 5));
  assert.deepEqual(output.map(withoutAllowedIds), input.map(withoutAllowedIds));
  for (const e of output) {
    if (e.item_id) assert.equal(e.item_id, canonical[e.output_index]);
    if (e.item) assert.equal(e.item.id, canonical[e.output_index]);
    if (e.response) {
      assert.equal(e.response.id, 'R');
      assert.deepEqual(e.response.output.map(x => x.id), canonical.slice(0, e.response.output.length));
    }
  }
});

test('same-frame first-observed ID follows lexical property order, including escaped property names', async () => {
  const bytes = Buffer.from('data: {"type":"response.created","response":{"i\\u0064":"first","output":[]},"response_id":"second"}\n\n'
    + 'data: {"type":"response.output_item.added","output_index":0,"item_id":"item-first","item":{"id":"item-second","type":"message"}}\n\n');
  const [a, b] = events(await transform(bytes, 1));
  assert.equal(a.response_id, 'first');
  assert.equal(b.item.id, 'item-first');
});

test('snapshot establishes IDs before any item events without inventing missing IDs', async () => {
  const input = [
    { type: 'response.in_progress', response: { output: [{ id: 's0' }, {}, { id: 's2' }] } },
    { type: 'response.output_text.delta', output_index: 2, item_id: 'late2', delta: 'x' },
    { type: 'response.output_item.added', output_index: 0, item: { id: 'late0' } },
    { type: 'response.output_item.added', output_index: 1, item: { id: 'new1' } },
    { type: 'response.completed', response: { output: [{ id: 'end0' }, {}, { id: 'end2' }] } }
  ];
  const output = events(await transform(Buffer.from(input.map(x => frame(x)).join(''))));
  assert.equal(output[1].item_id, 's2');
  assert.equal(output[2].item.id, 's0');
  assert.equal(output[3].item.id, 'new1');
  assert.deepEqual(output[4].response.output, [{ id: 's0' }, {}, { id: 's2' }]);
  assert.ok(output.filter(e => e.response).every(e => !Object.hasOwn(e.response, 'id')));
});

test('normal well-formed streams are byte-identical, including CRLF, BOM, comments, whitespace and DONE', async () => {
  const raw = '\ufeff: hello\r\n\r\n' + 'event: response.created\r\ndata: { "type":"response.created", "response":{"id":"R","output":[]} }\r\n\r\n'
    + 'event: response.output_item.added\ndata:{"type":"response.output_item.added","output_index":0,"item":{"id":"m","type":"message"}}\n\n'
    + 'data: {"type":"response.output_text.delta","output_index":0,"item_id":"m","delta":"汉字🙂é"}\n\n'
    + 'id: stream-cursor\nevent: message\ndata: {"type":"response.completed","response":{"id":"R","output":[{"id":"m"}]}}\n\n'
    + ': end\r\n\r\ndata: [DONE]\r\n\r\n';
  for (const size of [1, 2, 17, 100000]) assert.deepEqual(await transform(Buffer.from(raw), size), Buffer.from(raw));
});

test('invalid or missing output indices and empty/non-string IDs never guess an item mapping', async () => {
  const input = [
    { type: 'response.output_item.added', output_index: 0, item: { id: 'm' } },
    ...[undefined, null, -1, 0.5, '0', 9007199254740992].map(output_index => ({ type: 'response.output_item.done', output_index, item_id: 'wrong', item: { id: 'wrong' } })),
    ...[null, '', 123, false, {}, []].map(id => ({ type: 'response.output_item.done', output_index: 0, item_id: id, item: { id }, response_id: id, response: { id } })),
    { type: 'response.output_text.delta', output_index: 0, item: { id: 'arbitrary-not-an-output-item-event' }, delta: 'x' }
  ];
  const bytes = Buffer.from(input.map(x => frame(x)).join(''));
  assert.deepEqual(await transform(bytes, 13), bytes);
});

test('independent invocations never share canonical response or item IDs', async () => {
  const results = await Promise.all(['A', 'B', 'C'].map(async prefix => {
    const first = { type: 'response.created', response: { id: prefix, output: [{ id: prefix + '-m' }] } };
    const last = { type: 'response.completed', response: { id: 'bad', output: [{ id: 'bad-m' }] } };
    const output = events(await transform(Buffer.from(frame(first) + frame(last)), 1));
    assert.equal(output[1].response.id, prefix);
    assert.equal(output[1].response.output[0].id, prefix + '-m');
    return output;
  }));
  assert.equal(results.length, 3);
});

for (const type of ['response.failed', 'response.incomplete', 'error']) test(`terminal ${type} preserves error/status details and creates no completion or retry`, async () => {
  const input = [
    { type: 'response.created', response: { id: 'R', output: [] } },
    { type, ...(type === 'error' ? {} : { response: { id: 'wrong', status: type.split('.')[1], output: [], error: { code: 'upstream_error', message: 'boom', id: 'error-id' } } }), error: { code: 'upstream_error', message: 'boom', id: 'error-id' } }
  ];
  const output = events(await transform(Buffer.from(input.map(x => frame(x)).join('')), 9));
  assert.equal(output.length, 2);
  assert.deepEqual(output.map(withoutAllowedIds), input.map(withoutAllowedIds));
  if (output[1].response) assert.equal(output[1].response.id, 'R');
  assert.ok(!output.some(x => x.type === 'response.completed'));
});

test('complete CRLF frame is readable before upstream closes; partial frame waits for delimiter', { timeout: 3000 }, async () => {
  let upstream;
  const readable = new ReadableStream({ start(c) { upstream = c; } });
  const reader = stabilizeResponseStream(readable).getReader();
  const first = frame({ type: 'response.created', response: { id: 'R', output: [] } }, '\r\n');
  upstream.enqueue(Buffer.from(first));
  assert.equal(decoder.decode((await reader.read()).value), first);
  const last = frame({ type: 'response.completed', response: { id: 'bad', output: [] } }, '\r\n');
  upstream.enqueue(Buffer.from(last.slice(0, -1)));
  let settled = false;
  const pendingRead = reader.read().then(x => { settled = true; return x; });
  await nextTurn();
  assert.equal(settled, false);
  upstream.enqueue(Buffer.from(last.slice(-1)));
  assert.equal(events((await pendingRead).value)[0].response.id, 'R');
  upstream.close();
  assert.equal((await reader.read()).done, true);
});

test('upstream transport error propagates the same object and never flushes an artificial completion', { timeout: 3000 }, async () => {
  let upstream;
  const readable = new ReadableStream({ start(c) { upstream = c; } });
  const reader = stabilizeResponseStream(readable).getReader();
  upstream.enqueue(Buffer.from(frame({ type: 'response.created', response: { id: 'R', output: [] } })));
  assert.equal(events((await reader.read()).value)[0].type, 'response.created');
  upstream.enqueue(Buffer.from('data: {"type":"response.completed"'));
  const failure = new Error('network reset');
  const next = reader.read();
  await nextTurn();
  upstream.error(failure);
  await assert.rejects(next, e => e === failure);
  await assert.rejects(reader.closed, e => e === failure);
});

test('downstream cancellation propagates the exact reason once to upstream', { timeout: 3000 }, async () => {
  let calls = 0;
  let finish;
  const cancelled = new Promise(resolve => { finish = resolve; });
  const readable = new ReadableStream({ cancel(reason) { calls++; finish(reason); } });
  const reader = stabilizeResponseStream(readable).getReader();
  const reason = new Error('consumer stopped');
  await reader.cancel(reason);
  assert.equal(await cancelled, reason);
  assert.equal(calls, 1);
});

test('native pipeThrough backpressure does not drain the upstream without a consumer', { timeout: 3000 }, async () => {
  let pulls = 0;
  let cancels = 0;
  const readable = new ReadableStream({
    pull(c) { pulls++; c.enqueue(Buffer.from(': heartbeat\n\n')); },
    cancel() { cancels++; }
  });
  const result = stabilizeResponseStream(readable);
  await nextTurn();
  await nextTurn();
  const stalled = pulls;
  assert.ok(stalled <= 2, `unexpected eager pulls=${stalled}`);
  await nextTurn();
  assert.equal(pulls, stalled);
  const reader = result.getReader();
  assert.equal(decoder.decode((await reader.read()).value), ': heartbeat\n\n');
  await nextTurn();
  assert.ok(pulls <= stalled + 1);
  await reader.cancel('done');
  await nextTurn();
  assert.equal(cancels, 1);
});

test('empty streams and unterminated tails pass through without fabrication', async () => {
  assert.deepEqual(await transform(Buffer.alloc(0)), Buffer.alloc(0));
  const first = frame({ type: 'response.created', response: { id: 'R', output: [] } });
  for (const suffix of ['data: {"type":"response.completed","response":{"id":"wrong"}}', '\r', 'data: {', ': tail\n']) {
    const input = Buffer.from(first + suffix);
    assert.deepEqual(await transform(input, 1), input);
  }
});

test('all possible two-chunk split points produce identical fixed output', async () => {
  const input = Buffer.from(frame({ type: 'response.created', response: { id: 'R', output: [] } }, '\r\n') + frame({ type: 'response.completed', response: { id: 'bad', output: [] }, text: '汉🙂字' }));
  const expected = await transform(input);
  for (let split = 0; split <= input.length; split++) {
    const stream = new ReadableStream({ start(c) { c.enqueue(input.subarray(0, split)); c.enqueue(input.subarray(split)); c.close(); } });
    assert.deepEqual(await collect(stabilizeResponseStream(stream)), expected, `split=${split}`);
  }
});

test('data-only events and event-only type fallback stabilize output items', async () => {
  const raw = 'event: response.output_item.added\ndata: {"output_index":0,"item":{"id":"m"}}\n\n'
    + 'data: {"type":"response.output_text.delta","output_index":0,"item_id":"bad","delta":"x"}\n\n'
    + 'event: response.output_item.done\ndata: {"output_index":0,"item":{"id":"wrong"}}\n\n';
  const output = events(await transform(Buffer.from(raw), 1));
  assert.equal(output[1].item_id, 'm');
  assert.equal(output[2].item.id, 'm');
});

test('UTF-8 BOM and opaque invalid UTF-8 frames remain byte-identical while later known IDs stabilize', async () => {
  const first = Buffer.from('\ufeff' + frame({ type: 'response.created', response: { id: 'r', output: [] } }));
  const opaque = Buffer.concat([Buffer.from(': bad-utf8-'), Buffer.from([0xff, 0xc0, 0xaf]), Buffer.from('\r\n\r\n')]);
  const last = frame({ type: 'response.completed', response: { id: 'wrong', output: [] } });
  const input = Buffer.concat([first, opaque, Buffer.from(last)]);
  const expected = Buffer.concat([first, opaque, Buffer.from(last.replace('"wrong"', '"r"'))]);
  assert.deepEqual(await transform(input, 1), expected);
});

test('rewriting only ID string tokens preserves large integers, negative zero, escapes and multiline formatting', async () => {
  const first = frame({ type: 'response.created', response: { id: 'r', output: [] } });
  const last = 'event: response.completed\r\ndata: { "type":"response.completed", "response":{"id":"bad","output":[]},\r\ndata: "count":900719925474099312345678901234567890, "negative":-0, "huge":1e400, "s":"\\u4e2d\\/" }\r\n\r\n';
  assert.deepEqual(await transform(encoder.encode(first + last), 7), Buffer.from(first + last.replace('"id":"bad"', '"id":"r"')));
});

test('unknown events, comments, DONE, malformed JSON and non-object JSON pass through without poisoning IDs', async () => {
  const unknown = ': heartbeat\n\nevent: response.future\ndata: {"type":"response.future","response":{"id":"poison"},"item_id":"poison","output_index":0}\n\n'
    + 'event: custom\ndata: {"type":"response.created","response":{"id":"poison2"}}\n\n'
    + ['null', '[]', '"str"', '123', '{oops', '[DONE]'].map(x => `data: ${x}\n\n`).join('');
  const known = frame({ type: 'response.created', response: { id: 'r', output: [] } })
    + frame({ type: 'response.completed', response: { id: 'wrong', output: [] } });
  const output = await transform(encoder.encode(unknown + known), 3);
  assert.equal(decoder.decode(output).slice(0, unknown.length), unknown);
  const parsed = events(output).filter(x => x?.response);
  assert.equal(parsed.at(-1).response.id, 'r');
});

test('CRLF multiline SSE with one-byte Unicode fragmentation preserves field metadata', async () => {
  const first = frame({ type: 'response.created', response: { id: 'r', output: [] } }, '\r\n');
  const last = 'id: cursor-9\r\n: 心跳🙂\r\nevent: response.completed\r\nretry: 100\r\ndata: {"type":"response.completed",\r\ndata: "response":{"id":"wrong","output":[]},"text":"汉字🙂é"}\r\n\r\n';
  const result = await transform(encoder.encode(first + last), 1);
  assert.equal(events(result)[1].response.id, 'r');
  assert.equal(events(result)[1].text, '汉字🙂é');
  const text = decoder.decode(result);
  for (const meta of ['id: cursor-9\r\n', ': 心跳🙂\r\n', 'event: response.completed\r\n', 'retry: 100\r\n']) assert.ok(text.includes(meta));
  assert.ok(text.endsWith('\r\n\r\n'));
});

test('response_id observed before a response snapshot establishes the request-local canonical ID', async () => {
  const input = [
    { type: 'response.output_text.delta', response_id: 'r-first', output_index: 0, item_id: 'm', delta: 'x' },
    { type: 'response.in_progress', response_id: 'r-second', response: { id: 'r-third', output: [] } },
    { type: 'response.completed', response: { id: 'r-fourth', output: [] } }
  ];
  const output = events(await transform(encoder.encode(input.map(x => frame(x)).join(''))));
  assert.equal(output[1].response_id, 'r-first');
  assert.equal(output[1].response.id, 'r-first');
  assert.equal(output[2].response.id, 'r-first');
});
const fixture = name => readFile(new URL(`./fixtures/${name}`, import.meta.url));
const frame = (value, eol = '\n') => `event: ${value.type}${eol}data: ${JSON.stringify(value)}${eol}${eol}`;
function source(bytes, size = bytes.length || 1) {
  let offset = 0;
  return new ReadableStream({ pull(c) {
    if (offset >= bytes.length) return c.close();
    c.enqueue(bytes.slice(offset, offset += size));
  }});
}
async function collect(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
const transform = (bytes, size) => collect(stabilizeResponseStream(source(bytes, size)));
function events(bytes) {
  return decoder.decode(bytes).split(/\r?\n\r?\n/).flatMap(block => {
    const data = block.split(/\r?\n/).filter(x => x.startsWith('data:')).map(x => x.slice(5).replace(/^ /, '')).join('\n');
    if (!data || data === '[DONE]') return [];
    try { return [JSON.parse(data)]; } catch { return []; }
  });
}

for (const name of fixtures) test(`real ${name}: first output item ID wins in all references and snapshots`, async () => {
  const input = await fixture(name);
  const before = events(input);
  const canonical = before.find(e => e.type === 'response.output_item.added').item.id;
  assert.ok(before.some(e => e.item_id && e.item_id !== canonical));
  for (const e of events(await transform(input, 97))) {
    if (e.item_id) assert.equal(e.item_id, canonical, e.type);
    if (e.item) assert.equal(e.item.id, canonical, e.type);
    if (e.response?.output?.length) assert.equal(e.response.output[0].id, canonical, e.type);
  }
});

for (const name of fixtures) test(`real ${name}: first response ID wins`, async () => {
  const input = await fixture(name);
  const before = events(input).filter(e => e.response?.id);
  assert.ok(new Set(before.map(e => e.response.id)).size > 1, 'fixture must actually reproduce the upstream bug');
  const after = events(await transform(input));
  for (const e of after.filter(e => e.response?.id)) {
    assert.equal(e.response.id, before[0].response.id, `${e.type} changed response ID`);
  }
});
