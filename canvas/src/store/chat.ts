import { create } from 'zustand';

export interface ChatMessageUI {
  id: string;
  role: 'user' | 'assistant';
  content: string | null;
  toolCalls: ToolCallUI[];
  isStreaming?: boolean;
  createdAt: number;
}

export interface ToolCallUI {
  id: string;
  tool: string;
  input?: any;
  result?: string;
  hasImage?: boolean;
  error?: string;
  status: 'pending' | 'complete' | 'error';
}

export interface ChatSummary {
  id: string;
  title: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ChatState {
  chats: ChatSummary[];
  activeChatId: string | null;
  messages: ChatMessageUI[];
  isStreaming: boolean;
  abortController: AbortController | null;

  loadChats: () => Promise<void>;
  createChat: () => Promise<string>;
  openChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  sendMessage: (content: string, uiContext?: any) => Promise<void>;
  cancelGeneration: () => void;

  _appendTextDelta: (delta: string) => void;
  _addToolCall: (tc: ToolCallUI) => void;
  _updateToolResult: (id: string, result: string, hasImage?: boolean, error?: string) => void;
  _finishStreaming: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: [],
  isStreaming: false,
  abortController: null,

  loadChats: async () => {
    const res = await fetch('/api/chats');
    const chats = await res.json();
    set({ chats });
  },

  createChat: async () => {
    const res = await fetch('/api/chats', { method: 'POST' });
    const chat = await res.json();
    set(s => ({ chats: [chat, ...s.chats], activeChatId: chat.id, messages: [] }));
    return chat.id;
  },

  openChat: async (chatId: string) => {
    const res = await fetch(`/api/chats/${chatId}`);
    const data = await res.json();

    const messages: ChatMessageUI[] = (data.messages ?? [])
      .filter((m: any) => m.content || m.toolCalls) // skip tool-result-only messages
      .map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls ? JSON.parse(m.toolCalls).map((tc: any) => ({
          id: tc.id, tool: tc.name, input: tc.input, status: 'complete' as const,
        })) : [],
        createdAt: m.createdAt,
      }));

    set({ activeChatId: chatId, messages });
  },

  deleteChat: async (chatId: string) => {
    await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
    set(s => ({
      chats: s.chats.filter(c => c.id !== chatId),
      activeChatId: s.activeChatId === chatId ? null : s.activeChatId,
      messages: s.activeChatId === chatId ? [] : s.messages,
    }));
  },

  sendMessage: async (content: string, uiContext?: any) => {
    const state = get();
    let chatId = state.activeChatId;

    if (!chatId) {
      chatId = await get().createChat();
    }

    const userMsg: ChatMessageUI = {
      id: `pending_${Date.now()}`,
      role: 'user',
      content,
      toolCalls: [],
      createdAt: Date.now(),
    };
    set(s => ({ messages: [...s.messages, userMsg] }));

    const assistantMsg: ChatMessageUI = {
      id: `streaming_${Date.now()}`,
      role: 'assistant',
      content: '',
      toolCalls: [],
      isStreaming: true,
      createdAt: Date.now(),
    };
    set(s => ({ messages: [...s.messages, assistantMsg], isStreaming: true }));

    const abortController = new AbortController();
    set({ abortController });

    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, uiContext }),
        signal: abortController.signal,
      });

      if (!res.ok || !res.body) {
        get()._finishStreaming();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            const store = get();

            if (eventType === 'text') {
              store._appendTextDelta(data.text ?? data.delta);
            } else if (eventType === 'tool_start') {
              store._addToolCall({ id: data.toolUseId ?? data.id, tool: data.name ?? data.tool, input: data.input, status: 'pending' });
            } else if (eventType === 'tool_result') {
              store._updateToolResult(data.toolUseId ?? data.id, typeof data.result === 'object' ? JSON.stringify(data.result) : (data.result ?? data.summary ?? ''), data.hasImage, data.error);
            } else if (eventType === 'done') {
              store._finishStreaming();
            } else if (eventType === 'error') {
              store._appendTextDelta(`\n\nError: ${data.error}`);
              store._finishStreaming();
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        get()._appendTextDelta(`\n\nConnection error: ${err.message}`);
      }
      get()._finishStreaming();
    }

    get().loadChats();
  },

  cancelGeneration: () => {
    const { abortController, activeChatId } = get();
    if (abortController) abortController.abort();
    if (activeChatId) {
      fetch(`/api/chats/${activeChatId}/cancel`, { method: 'POST' });
    }
    get()._finishStreaming();
  },

  _appendTextDelta: (delta: string) => {
    set(s => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant' && last.isStreaming) {
        msgs[msgs.length - 1] = { ...last, content: (last.content ?? '') + delta };
      }
      return { messages: msgs };
    });
  },

  _addToolCall: (tc: ToolCallUI) => {
    set(s => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant' && last.isStreaming) {
        msgs[msgs.length - 1] = { ...last, toolCalls: [...last.toolCalls, tc] };
      }
      return { messages: msgs };
    });
  },

  _updateToolResult: (id: string, result: string, hasImage?: boolean, error?: string) => {
    set(s => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant' && last.isStreaming) {
        const toolCalls = last.toolCalls.map(tc =>
          tc.id === id ? { ...tc, result, hasImage, error, status: error ? 'error' as const : 'complete' as const } : tc
        );
        msgs[msgs.length - 1] = { ...last, toolCalls };
      }
      return { messages: msgs };
    });
  },

  _finishStreaming: () => {
    set(s => {
      const msgs = s.messages.map(m =>
        m.isStreaming ? { ...m, isStreaming: false } : m
      );
      return { messages: msgs, isStreaming: false, abortController: null };
    });
  },
}));
