// @vitest-environment node
import { describe, it, expect } from 'vitest';

describe('ZIP export endpoint contract', () => {
  it('ExportActions references ?export=zip (not ?download=1)', async () => {
    // Read the component source and verify the URL pattern
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(
      path.resolve(__dirname, '../components/ExportActions.tsx'),
      'utf-8'
    );
    expect(source).toContain('export=zip');
    expect(source).not.toContain('download=1');
  });

  it('ExportActions uses .zip filename', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(
      path.resolve(__dirname, '../components/ExportActions.tsx'),
      'utf-8'
    );
    expect(source).toContain('.zip');
  });

  it('ExportActions label is ZIP not HTML', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(
      path.resolve(__dirname, '../components/ExportActions.tsx'),
      'utf-8'
    );
    // The label prop passed to ExportButton should be "ZIP"
    expect(source).toContain('label="ZIP"');
  });
});
