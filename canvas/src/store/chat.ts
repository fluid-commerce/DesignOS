import { create } from 'zustand';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useCampaignStore } from './campaign';

const ACTIVE_CHAT_KEY = 'fluid.activeChatId';

function readActiveChatId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_CHAT_KEY);
  } catch {
    return null;
  }
}

function writeActiveChatId(id: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (id) localStorage.setItem(ACTIVE_CHAT_KEY, id);
    else localStorage.removeItem(ACTIVE_CHAT_KEY);
  } catch {}
}

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
  activeChatId: readActiveChatId(),
  messages: [],
  isStreaming: false,
  abortController: null,

  loadChats: async () => {
    const res = await fetch('/api/chats');
    const chats = await res.json();
    set({ chats });
    // If we have a persisted activeChatId but no messages loaded yet, hydrate it.
    const { activeChatId, messages } = get();
    if (
      activeChatId &&
      messages.length === 0 &&
      chats.some((c: ChatSummary) => c.id === activeChatId)
    ) {
      get()
        .openChat(activeChatId)
        .catch(() => {
          // Stale pointer — clear it so we don't keep retrying.
          writeActiveChatId(null);
          set({ activeChatId: null });
        });
    }
  },

  createChat: async () => {
    const res = await fetch('/api/chats', { method: 'POST' });
    const chat = await res.json();
    writeActiveChatId(chat.id);
    set((s) => ({ chats: [chat, ...s.chats], activeChatId: chat.id, messages: [] }));
    return chat.id;
  },

  openChat: async (chatId: string) => {
    const res = await fetch(`/api/chats/${chatId}`);
    if (!res.ok) throw new Error(`Failed to open chat ${chatId}`);
    const data = await res.json();

    const messages: ChatMessageUI[] = (data.messages ?? [])
      .filter((m: any) => m.content || m.toolCalls) // skip tool-result-only messages
      .map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls
          ? JSON.parse(m.toolCalls).map((tc: any) => ({
              id: tc.id,
              tool: tc.name,
              input: tc.input,
              status: 'complete' as const,
            }))
          : [],
        createdAt: m.createdAt,
      }));

    writeActiveChatId(chatId);
    set({ activeChatId: chatId, messages });
  },

  deleteChat: async (chatId: string) => {
    await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
    set((s) => {
      const clearing = s.activeChatId === chatId;
      if (clearing) writeActiveChatId(null);
      return {
        chats: s.chats.filter((c) => c.id !== chatId),
        activeChatId: clearing ? null : s.activeChatId,
        messages: clearing ? [] : s.messages,
      };
    });
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
    set((s) => ({ messages: [...s.messages, userMsg] }));

    const assistantMsg: ChatMessageUI = {
      id: `streaming_${Date.now()}`,
      role: 'assistant',
      content: '',
      toolCalls: [],
      isStreaming: true,
      createdAt: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, assistantMsg], isStreaming: true }));

    const abortController = new AbortController();
    set({ abortController });

    function handleSSE(eventType: string, data: any) {
      const store = get();
      if (eventType === 'text') {
        store._appendTextDelta(data.text ?? data.delta);
      } else if (eventType === 'tool_start') {
        store._addToolCall({
          id: data.toolUseId ?? data.id,
          tool: data.name ?? data.tool,
          input: data.input,
          status: 'pending',
        });
      } else if (eventType === 'tool_result') {
        store._updateToolResult(
          data.toolUseId ?? data.id,
          typeof data.result === 'object'
            ? JSON.stringify(data.result)
            : (data.result ?? data.summary ?? ''),
          data.hasImage,
          data.error,
        );
      } else if (eventType === 'creation_ready') {
        // Creation saved — refresh campaign data so the canvas picks it up
        // immediately instead of waiting on file-watcher latency.
        //
        // Only refetch creations if the save happened inside the campaign
        // the user is currently viewing — otherwise we'd overwrite their
        // visible creations list with a different campaign's creations.
        const campaignStore = useCampaignStore.getState();
        campaignStore.fetchCampaigns();
        if (data.campaignId && data.campaignId === campaignStore.activeCampaignId) {
          campaignStore.fetchCreations(data.campaignId);
        }
      } else if (eventType === 'validation_result') {
        // Append validation result as info in the chat
        if (data.result) {
          store._appendTextDelta(`\n\n📋 ${data.result}`);
        }
      } else if (eventType === 'done') {
        store._finishStreaming();
      } else if (eventType === 'error') {
        store._appendTextDelta(`\n\nError: ${data.error}`);
        store._finishStreaming();
      }
    }

    await fetchEventSource(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ content, uiContext }),
      signal: abortController.signal,
      openWhenHidden: true,
      onmessage: (msg) => {
        if (!msg.event) return;
        try {
          const data = JSON.parse(msg.data);
          handleSSE(msg.event, data);
        } catch {
          // Drop malformed SSE payloads rather than killing the stream.
        }
      },
      onerror: (err) => {
        if (err?.name !== 'AbortError') {
          get()._appendTextDelta(`\n\nConnection error: ${err.message}`);
        }
        get()._finishStreaming();
        // Throw to disable the library's built-in reconnect/retry.
        throw err;
      },
      onclose: () => {
        // If the server closed cleanly without a `done` event, still finalize.
        if (get().isStreaming) get()._finishStreaming();
      },
    }).catch((err: any) => {
      // fetchEventSource rejects when onerror throws — already handled above.
      // Only handle unexpected errors that bypass onerror (e.g. AbortError).
      if (err?.name !== 'AbortError' && get().isStreaming) {
        get()._finishStreaming();
      }
    });

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
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant' && last.isStreaming) {
        msgs[msgs.length - 1] = { ...last, content: (last.content ?? '') + delta };
      }
      return { messages: msgs };
    });
  },

  _addToolCall: (tc: ToolCallUI) => {
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant' && last.isStreaming) {
        msgs[msgs.length - 1] = { ...last, toolCalls: [...last.toolCalls, tc] };
      }
      return { messages: msgs };
    });
  },

  _updateToolResult: (id: string, result: string, hasImage?: boolean, error?: string) => {
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant' && last.isStreaming) {
        const toolCalls = last.toolCalls.map((tc) =>
          tc.id === id
            ? {
                ...tc,
                result,
                hasImage,
                error,
                status: error ? ('error' as const) : ('complete' as const),
              }
            : tc,
        );
        msgs[msgs.length - 1] = { ...last, toolCalls };
      }
      return { messages: msgs };
    });
  },

  _finishStreaming: () => {
    set((s) => {
      const msgs = s.messages.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m));
      return { messages: msgs, isStreaming: false, abortController: null };
    });
  },
}));
