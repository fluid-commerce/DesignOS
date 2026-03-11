import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PromptSidebar } from '../components/PromptSidebar';
import { StreamMessage } from '../components/StreamMessage';
import { App } from '../App';
import type { StreamUIMessage } from '../lib/stream-parser';

// Mock useGenerationStream
const mockGenerate = vi.fn();
let mockStatus: 'idle' | 'generating' | 'complete' | 'error' = 'idle';
let mockEvents: StreamUIMessage[] = [];

vi.mock('../hooks/useGenerationStream', () => ({
  useGenerationStream: () => ({
    generate: mockGenerate,
    status: mockStatus,
    events: mockEvents,
  }),
}));

// Mock useGenerationStore for App tests
let mockStoreStatus: 'idle' | 'generating' | 'complete' | 'error' = 'idle';
vi.mock('../store/generation', () => ({
  useGenerationStore: (selector?: any) => {
    const state = {
      status: mockStoreStatus,
      events: [],
      activeSessionId: null,
      activePid: null,
    };
    return selector ? selector(state) : state;
  },
}));

// Mock useFileWatcher
vi.mock('../hooks/useFileWatcher', () => ({
  useFileWatcher: () => {},
}));

// Mock useAnnotations
vi.mock('../hooks/useAnnotations', () => ({
  useAnnotations: () => ({
    annotations: [],
    statuses: {},
    activePin: null,
    setActivePin: vi.fn(),
    setStatus: vi.fn(),
    sidebarNotes: [],
    addPin: vi.fn(),
    addNote: vi.fn(),
    addReply: vi.fn(),
  }),
}));

// Mock session store
vi.mock('../store/sessions', () => ({
  useSessionStore: (selector: any) => {
    const state = {
      refreshSessions: vi.fn(),
      activeSessionData: null,
      activeSessionId: null,
      loading: false,
      sessions: [],
      setActiveSessionId: vi.fn(),
    };
    return selector(state);
  },
}));

// Mock fetch for TemplateGallery
beforeEach(() => {
  vi.clearAllMocks();
  mockStatus = 'idle';
  mockEvents = [];
  mockStoreStatus = 'idle';
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  });
});

describe('PromptSidebar', () => {
  it('renders textarea and Generate button', () => {
    render(<PromptSidebar />);
    expect(screen.getByPlaceholderText(/describe what you want/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
  });

  it('textarea is disabled when generation status is generating', () => {
    mockStatus = 'generating';
    render(<PromptSidebar />);
    const textarea = screen.getByPlaceholderText(/describe what you want/i);
    expect(textarea).toBeDisabled();
  });
});

describe('StreamMessage', () => {
  it('renders text type as dark bubble', () => {
    const msg: StreamUIMessage = {
      id: 'msg-1',
      type: 'text',
      content: 'Hello from the agent',
      timestamp: Date.now(),
    };
    const { container } = render(<StreamMessage message={msg} />);
    const bubble = container.firstElementChild as HTMLElement;
    expect(bubble.textContent).toContain('Hello from the agent');
    expect(bubble.dataset.msgType).toBe('text');
  });

  it('renders tool-start as status pill', () => {
    const msg: StreamUIMessage = {
      id: 'msg-2',
      type: 'tool-start',
      content: 'Reading file...',
      toolName: 'Read',
      timestamp: Date.now(),
    };
    const { container } = render(<StreamMessage message={msg} />);
    const pill = container.firstElementChild as HTMLElement;
    expect(pill.textContent).toContain('Reading file...');
    expect(pill.dataset.msgType).toBe('tool-start');
  });

  it('renders error type as red bubble', () => {
    const msg: StreamUIMessage = {
      id: 'msg-3',
      type: 'error',
      content: 'Something went wrong',
      timestamp: Date.now(),
    };
    const { container } = render(<StreamMessage message={msg} />);
    const bubble = container.firstElementChild as HTMLElement;
    expect(bubble.dataset.msgType).toBe('error');
  });

  it('renders status type as centered grey text', () => {
    const msg: StreamUIMessage = {
      id: 'msg-4',
      type: 'status',
      content: 'Generation complete',
      timestamp: Date.now(),
    };
    const { container } = render(<StreamMessage message={msg} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.dataset.msgType).toBe('status');
    expect(el.textContent).toContain('Generation complete');
  });
});

describe('App', () => {
  it('renders gallery view by default when no session is active', async () => {
    render(<App />);
    await waitFor(() => {
      // TemplateGallery renders heading "Choose a Template" -- use getAllByText since
      // "Create with AI" appears in both sidebar and gallery
      const headings = screen.getAllByText(/choose a template/i);
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders the prompt sidebar always present', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/describe what you want/i)).toBeInTheDocument();
  });
});
