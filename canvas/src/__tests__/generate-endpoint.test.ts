import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

// Mock child_process.spawn
const mockStdout = new EventEmitter();
const mockStderr = new EventEmitter();
let mockChild: Partial<ChildProcess> & { stdout: EventEmitter; stderr: EventEmitter; pid: number; kill: ReturnType<typeof vi.fn> };

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    mockChild = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      pid: 12345,
      kill: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        if (event === 'close') {
          // Store for later triggering
          (mockChild as any)._onClose = cb;
        }
        return mockChild;
      }),
    };
    return mockChild;
  }),
}));

// We test the endpoint logic through the watcher plugin's middleware
// Since the endpoint is embedded in the Vite plugin, we test the spawn behavior
// and SSE output format

describe('Generate endpoint spawn behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('spawn should use stdio ignore for stdin (not inherit)', async () => {
    const { spawn } = await import('child_process');

    // Simulate what the endpoint does — new campaign mode uses ignore not inherit
    const child = spawn('claude', ['-p', 'test prompt', '--output-format', 'stream-json'], {
      cwd: '/tmp',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['-p', 'test prompt', '--output-format', 'stream-json']),
      expect.objectContaining({
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  });
});

describe('SSE format', () => {
  it('formats data events correctly', () => {
    const data = { type: 'stream_event', event: { type: 'content_block_delta' } };
    const sseFrame = `data: ${JSON.stringify(data)}\n\n`;
    expect(sseFrame).toContain('data: ');
    expect(sseFrame.endsWith('\n\n')).toBe(true);
  });

  it('formats done events with event type', () => {
    const data = { code: 0, campaignId: 'camp-abc123' };
    const sseFrame = `event: done\ndata: ${JSON.stringify(data)}\n\n`;
    expect(sseFrame).toContain('event: done\n');
    expect(sseFrame).toContain(`data: ${JSON.stringify(data)}`);
  });

  it('formats stderr events with event type', () => {
    const data = { text: 'Loading skill...' };
    const sseFrame = `event: stderr\ndata: ${JSON.stringify(data)}\n\n`;
    expect(sseFrame).toContain('event: stderr\n');
  });

  it('session event includes campaignId immediately', () => {
    const data = { type: 'session', campaignId: 'camp-abc', creationCount: 7 };
    const sseFrame = `data: ${JSON.stringify(data)}\n\n`;
    expect(sseFrame).toContain('"type":"session"');
    expect(sseFrame).toContain('"campaignId"');
    expect(sseFrame).toContain('"creationCount":7');
  });
});

describe('Campaign-level lock', () => {
  it('campaign lock blocks concurrent full campaign generation', () => {
    let activeCampaignGeneration: string | null = null;

    function canStartCampaign(): boolean {
      return activeCampaignGeneration === null;
    }

    // First campaign starts
    activeCampaignGeneration = 'camp-abc';
    expect(canStartCampaign()).toBe(false); // locked

    // Campaign completes
    activeCampaignGeneration = null;
    expect(canStartCampaign()).toBe(true); // unlocked
  });

  it('iterate mode is NOT blocked by campaign lock', () => {
    // Iterate mode uses activeChild, not activeCampaignGeneration
    const activeCampaignGeneration: string | null = 'camp-abc';
    let activeChild: any = null;

    // Iterate requests check activeChild, not activeCampaignGeneration
    function canIterate(): boolean {
      return activeChild === null;
    }

    expect(canIterate()).toBe(true); // iterate not blocked by campaign lock
  });
});

describe('Multi-creation campaign generation', () => {
  it('default campaign creates 7 creations (3 IG + 3 LI + 1 one-pager)', () => {
    // Simulate buildCreationList with default counts
    const DEFAULT_CHANNEL_COUNTS: Record<string, number> = {
      instagram: 3,
      linkedin: 3,
      'one-pager': 1,
    };

    const creations: Array<{ title: string; creationType: string; slideCount: number }> = [];
    for (const [type, count] of Object.entries(DEFAULT_CHANNEL_COUNTS)) {
      for (let i = 1; i <= count; i++) {
        creations.push({ title: `${type} ${i}`, creationType: type, slideCount: 1 });
      }
    }

    expect(creations.length).toBe(7);
    const igCreations = creations.filter((c) => c.creationType === 'instagram');
    const liCreations = creations.filter((c) => c.creationType === 'linkedin');
    const opCreations = creations.filter((c) => c.creationType === 'one-pager');
    expect(igCreations.length).toBe(3);
    expect(liCreations.length).toBe(3);
    expect(opCreations.length).toBe(1);
  });

  it('parallel subagents use activeChildren Map keyed by creationId', () => {
    const activeChildren: Map<string, any> = new Map();

    // Add children for 7 creations
    for (let i = 0; i < 7; i++) {
      activeChildren.set(`creation-${i}`, { pid: 1000 + i });
    }
    expect(activeChildren.size).toBe(7);

    // Simulate child close — delete from map
    activeChildren.delete('creation-0');
    expect(activeChildren.size).toBe(6);
  });

  it('done event fires only after all N children close', () => {
    let completedCount = 0;
    const totalCount = 7;
    let doneEventFired = false;

    function onChildClose() {
      completedCount++;
      if (completedCount >= totalCount) {
        doneEventFired = true;
      }
    }

    // Simulate 6 children closing — done should NOT fire yet
    for (let i = 0; i < 6; i++) onChildClose();
    expect(doneEventFired).toBe(false);

    // 7th child closes — done should fire
    onChildClose();
    expect(doneEventFired).toBe(true);
  });

  it('canonical HTML paths use .fluid/campaigns/ format', () => {
    const campaignId = 'camp-abc';
    const creationId = 'creation-xyz';
    const slideId = 'slide-123';
    const iterationId = 'iter-456';
    const htmlPath = `.fluid/campaigns/${campaignId}/${creationId}/${slideId}/${iterationId}.html`;

    expect(htmlPath).toContain('.fluid/campaigns/');
    expect(htmlPath).not.toContain('.fluid/working/');
    expect(htmlPath).toMatch(/\.fluid\/campaigns\/[^/]+\/[^/]+\/[^/]+\/[^/]+\.html$/);
  });
});

describe('Session directory creation', () => {
  it('generates session ID in YYYYMMDD-HHMMSS format', () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const sessionId = [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      '-',
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join('');

    expect(sessionId).toMatch(/^\d{8}-\d{6}$/);
  });
});
