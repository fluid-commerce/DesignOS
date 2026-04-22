import { describe, it, expect } from 'vitest';
import {
  makeSSEResponse,
  makeMalformedSSEResponse,
  serializeEvent,
} from './sse-fixtures';

async function readAll(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

describe('sse-fixtures', () => {
  it('serializes a single event in the SSE wire format', () => {
    expect(serializeEvent({ event: 'text', data: { text: 'hi' } })).toBe(
      'event: text\ndata: {"text":"hi"}\n\n',
    );
  });

  it('builds a Response whose body contains all serialized events in order', async () => {
    const res = makeSSEResponse([
      { event: 'text', data: { text: 'a' } },
      { event: 'text', data: { text: 'b' } },
      { event: 'done', data: {} },
    ]);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    const body = await readAll(res);
    expect(body).toContain('event: text\ndata: {"text":"a"}\n\n');
    expect(body).toContain('event: text\ndata: {"text":"b"}\n\n');
    expect(body).toContain('event: done\ndata: {}\n\n');
    expect(body.indexOf('"a"')).toBeLessThan(body.indexOf('"b"'));
  });

  it('injects keep-alive comments when requested', async () => {
    const res = makeSSEResponse([{ event: 'text', data: { text: 'a' } }], {
      injectKeepAlives: true,
    });
    const body = await readAll(res);
    expect(body).toContain(': keep-alive\n\n');
  });

  it('splits events across multiple chunks when splitAcross > 1', async () => {
    const res = makeSSEResponse([{ event: 'text', data: { text: 'abcdef' } }], {
      splitAcross: 4,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let chunkCount = 0;
    let combined = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunkCount++;
      combined += decoder.decode(value, { stream: true });
    }
    expect(chunkCount).toBeGreaterThan(1);
    expect(combined).toBe('event: text\ndata: {"text":"abcdef"}\n\n');
  });

  it('errors at end when errorAtEnd is set (simulates server-killed stream)', async () => {
    const res = makeSSEResponse(
      [{ event: 'text', data: { text: 'partial' } }],
      { errorAtEnd: new Error('connection dropped') },
    );
    const reader = res.body!.getReader();
    await reader.read();
    await expect(reader.read()).rejects.toMatchObject({ message: 'connection dropped' });
  });

  it('malformed response includes partial event, stray CRLFs, keep-alive, and multiline data', async () => {
    const res = makeMalformedSSEResponse([{ event: 'done', data: {} }]);
    const body = await readAll(res);
    expect(body).toContain('event: partial\ndata: {"incomplete":');
    expect(body).toContain('\r\n\r\n');
    expect(body).toContain(': a keep-alive comment\n\n');
    expect(body).toContain('event: multiline\ndata: line-one\ndata: line-two\n\n');
    expect(body).toContain('event: done');
  });
});
