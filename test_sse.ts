import assert from 'node:assert';
import { CustomSSEParser } from './src/ai/client.js';

function runSelfCheck() {
  const parser = new CustomSSEParser();

  // 1. Partial chunk split across boundaries
  const part1 = parser.feed('data: {"choices": [{"delta": {"con');
  assert.strictEqual(part1.length, 0, 'Partial chunk should buffer and yield no events');

  const part2 = parser.feed('tent": "Revisi "}}]}\n\n');
  assert.strictEqual(part2.length, 1, 'Completed chunk should yield 1 event');
  assert.strictEqual(JSON.parse(part2[0].data).choices[0].delta.content, 'Revisi ');

  // 2. CRLF (\r\n\r\n) multi-events and comments
  const multi = parser.feed(': ping comment\r\n\r\ndata: {"choices": [{"delta": {"content": "Selesai"}}]}\r\n\r\ndata: [DONE]\r\n\r\n');
  assert.strictEqual(multi.length, 2, 'Should parse 2 data events ignoring comments');
  assert.strictEqual(JSON.parse(multi[0].data).choices[0].delta.content, 'Selesai');
  assert.strictEqual(multi[1].data, '[DONE]');

  // 3. Flush trailing buffer
  parser.feed('data: {"choices": [{"delta": {"reasoning_content": "Pikir"}}]}');
  const flushed = parser.flush();
  assert.strictEqual(flushed.length, 1, 'Flush should extract final un-delimited event');
  assert.strictEqual(JSON.parse(flushed[0].data).choices[0].delta.reasoning_content, 'Pikir');

  console.log('✔ CustomSSEParser assertion self-checks PASSED');
}

runSelfCheck();
