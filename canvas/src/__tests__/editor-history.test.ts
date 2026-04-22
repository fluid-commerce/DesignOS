import { describe, expect, it } from 'vitest';
import { applySlotValuesToIframe } from '../lib/editor-history';
import type { SlotSchema } from '../lib/slot-schema';

describe('applySlotValuesToIframe', () => {
  it('sends transform before textBox for the same element so layout left/top are not wiped', () => {
    const order: string[] = [];
    const win = {
      postMessage: (msg: unknown) => {
        const m = msg as { action?: string; sel?: string };
        if (m && typeof m === 'object' && m.action && m.sel) {
          order.push(`${m.action}:${m.sel}`);
        }
      },
    } as unknown as Window;

    const schema: SlotSchema = {
      width: 1080,
      height: 1080,
      fields: [{ type: 'text', sel: '.slot', label: 'Slot', mode: 'text' }],
      brush: null,
    };

    applySlotValuesToIframe(
      {
        '.slot': 'text',
        '__transform__:.slot': 'translate(10px, 20px) rotate(0deg) scale(1, 1)',
        '__textbox__:.slot': JSON.stringify({ w: null, h: null, l: 200, t: 40 }),
      },
      {},
      schema,
      win,
    );

    const transformIdx = order.findIndex((x) => x.startsWith('transform:'));
    const textBoxIdx = order.findIndex((x) => x.startsWith('textBox:'));
    expect(transformIdx).toBeGreaterThanOrEqual(0);
    expect(textBoxIdx).toBeGreaterThanOrEqual(0);
    expect(textBoxIdx).toBeGreaterThan(transformIdx);
  });

  it('applies plain slot keys before transform and textBox', () => {
    const order: string[] = [];
    const win = {
      postMessage: (msg: unknown) => {
        const m = msg as { action?: string; sel?: string; type?: string };
        if (m && typeof m === 'object' && m.type === 'tmpl') {
          if (m.action === 'img') order.push(`img:${m.sel}`);
          else if (m.action === 'transform') order.push(`transform:${m.sel}`);
          else if (m.action === 'textBox') order.push(`textBox:${m.sel}`);
          else if (m.sel) order.push(`text:${m.sel}`);
        }
      },
    } as unknown as Window;

    const schema: SlotSchema = {
      width: 1080,
      height: 1080,
      fields: [
        { type: 'text', sel: '.a', label: 'A', mode: 'text' },
        { type: 'image', sel: '.img', label: 'I', dims: '1x1' },
      ],
      brush: null,
    };

    applySlotValuesToIframe(
      {
        '.a': 'hello',
        '.img': '/x.png',
        '__transform__:.a': 'translate(0px,0px) rotate(0deg) scale(1,1)',
        '__textbox__:.a': '{}',
      },
      {},
      schema,
      win,
    );

    const textA = order.findIndex((x) => x === 'text:.a');
    const img = order.findIndex((x) => x.startsWith('img:'));
    const tr = order.findIndex((x) => x.startsWith('transform:.a'));
    const tb = order.findIndex((x) => x.startsWith('textBox:.a'));
    expect(textA).toBeGreaterThanOrEqual(0);
    expect(tr).toBeGreaterThan(textA);
    expect(tb).toBeGreaterThan(tr);
    expect(img).toBeLessThan(tr);
  });
});
