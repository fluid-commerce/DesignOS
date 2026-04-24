import { create } from 'zustand';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useCampaignStore } from './campaign';

const ACTIVE_CHAT_KEY = 'fluid.activeChatId';

// ─── Phase 24 Dispatch 4 types ────────────────────────────────────────────────

export type ToolTier = 'always-allow' | 'ask-first' | 'never-allow-by-default';

export interface ToolActivity {
  /** Unique key: "${tool}@${startedAt}" */
  key: string;
  tool: string;
  startedAt: number;
  tier: ToolTier;
  estCostUsd?: number;
  estDurationSec?: number;
  progressPct?: number;
}

export interface PendingPermission {
  promptId: string;
  chatId: string;
  tool: string;
  argsPreview: string;
  reason: string;
  estCostUsd?: number;
  openedAt: number;
}

export interface BudgetWarning {
  remainingUsd: number;
  capUsd: number;
  seenAt: number;
}

export interface UsageRollup {
  totalUsd: number;
  imagesGenerated: number;
  turns: number;
}

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

  // ── Phase 24 Dispatch 4 state ────────────────────────────────────────────
  /** keyed by chatId → list of currently-running tool invocations */
  activeTools: Record<string, ToolActivity[]>;
  /** keyed by chatId → permission prompts awaiting user decision */
  pendingPermissions: Record<string, PendingPermission[]>;
  /** keyed by chatId → most recent budget warning */
  budgetWarnings: Record<string, BudgetWarning>;
  /** keyed by chatId → last fetched usage rollup */
  usageRollups: Record<string, UsageRollup>;

  loadChats: () => Promise<void>;
  createChat: () => Promise<string>;
  openChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  sendMessage: (content: string, uiContext?: any, uploadedAssetIds?: string[]) => Promise<void>;
  cancelGeneration: () => void;

  /** Respond to a pending permission prompt. */
  respondToPermission: (
    chatId: string,
    promptId: string,
    decision: 'approve_once' | 'approve_session' | 'deny',
  ) => Promise<void>;
  /** Dismiss a budget warning for the given chat. */
  dismissBudgetWarning: (chatId: string) => void;
  /** Manually refresh the usage rollup for a chat. */
  fetchUsageRollup: (chatId: string) => Promise<void>;

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
  activeTools: {},
  pendingPermissions: {},
  budgetWarnings: {},
  usageRollups: {},

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

  sendMessage: async (content: string, uiContext?: any, uploadedAssetIds?: string[]) => {
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
        // `tool_start` is emitted from two different places with different
        // payload shapes:
        //
        //  (a) agent.ts (existing, pre-Phase-24): { toolUseId, name, input }
        //      — wires into the message's toolCalls list for the inline
        //        tool-call disclosure triangles under each assistant message.
        //
        //  (b) tool-dispatch.ts (Phase 24): { tool, tier, est_cost_usd,
        //      est_duration_sec } — wires into the Phase-24 activeTools chip
        //      indicator. No toolUseId, so it MUST NOT be fed into
        //      _addToolCall (which would create a toolCall with id=undefined
        //      that tool_result could never match).
        //
        // Discriminate by presence of `toolUseId` (agent.ts) vs `tier`
        // (tool-dispatch.ts). A payload with both is theoretically possible
        // but not emitted today — we key off toolUseId first.
        if (data.toolUseId !== undefined || data.id !== undefined) {
          // (a) agent.ts shape — message toolCalls list
          store._addToolCall({
            id: data.toolUseId ?? data.id,
            tool: data.name ?? data.tool,
            input: data.input,
            status: 'pending',
          });
        }
        if (data.tier !== undefined) {
          // (b) tool-dispatch.ts shape — activeTools chip
          const toolName: string = data.tool ?? data.name ?? 'unknown';
          const startedAt: number = Date.now();
          const activity: ToolActivity = {
            key: `${toolName}@${startedAt}`,
            tool: toolName,
            startedAt,
            tier: data.tier as ToolTier,
            estCostUsd: data.est_cost_usd,
            estDurationSec: data.est_duration_sec,
          };
          set((s) => ({
            activeTools: {
              ...s.activeTools,
              [chatId!]: [...(s.activeTools[chatId!] ?? []), activity],
            },
          }));
        }
      } else if (eventType === 'tool_progress') {
        // tool-dispatch.ts emits: { tool, pct, ...detail }
        const toolName: string = data.tool ?? data.name ?? 'unknown';
        const pct: number | undefined =
          typeof data.pct === 'number' ? data.pct : data.progress_pct;
        if (pct !== undefined) {
          set((s) => {
            const existing = s.activeTools[chatId!] ?? [];
            // Update the oldest matching entry — dispatcher doesn't carry a
            // unique invocation id, so if the same tool is running twice
            // concurrently, we update the first one. Acceptable for D4.
            const idx = existing.findIndex((a) => a.tool === toolName);
            if (idx === -1) return {};
            const updated = [...existing];
            updated[idx] = { ...updated[idx], progressPct: pct };
            return { activeTools: { ...s.activeTools, [chatId!]: updated } };
          });
        }
      } else if (eventType === 'tool_end') {
        // tool-dispatch.ts emits: { tool, duration_sec, outcome }
        // This is the activeTools lifecycle END signal. Remove the oldest
        // matching entry (pop FIFO since dispatcher has no invocation id).
        const toolName: string = data.tool ?? data.name ?? 'unknown';
        set((s) => {
          const existing = s.activeTools[chatId!] ?? [];
          const idx = existing.findIndex((a) => a.tool === toolName);
          if (idx === -1) return {};
          const updated = [...existing.slice(0, idx), ...existing.slice(idx + 1)];
          return { activeTools: { ...s.activeTools, [chatId!]: updated } };
        });
      } else if (eventType === 'tool_result') {
        // `tool_result` is agent.ts emitting the Anthropic tool_result block
        // back to the model. It is NOT the activeTools lifecycle — that's
        // `tool_end` above. We only update the message-level toolCalls list
        // (status + result body) here.
        store._updateToolResult(
          data.toolUseId ?? data.id,
          typeof data.result === 'object'
            ? JSON.stringify(data.result)
            : (data.result ?? data.summary ?? ''),
          data.hasImage,
          data.error,
        );
      } else if (eventType === 'permission_prompt') {
        const perm: PendingPermission = {
          promptId: data.promptId ?? data.prompt_id,
          chatId: chatId!,
          tool: data.tool,
          argsPreview: data.args_preview ?? '',
          reason: data.reason ?? '',
          estCostUsd: data.est_cost_usd,
          openedAt: Date.now(),
        };
        set((s) => ({
          pendingPermissions: {
            ...s.pendingPermissions,
            [chatId!]: [...(s.pendingPermissions[chatId!] ?? []), perm],
          },
        }));
      } else if (eventType === 'budget_warning') {
        const warning: BudgetWarning = {
          remainingUsd: data.remaining_usd ?? 0,
          capUsd: data.cap_usd ?? 0,
          seenAt: Date.now(),
        };
        set((s) => ({ budgetWarnings: { ...s.budgetWarnings, [chatId!]: warning } }));
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
        // Refresh usage rollup after turn completes
        if (chatId) store.fetchUsageRollup(chatId);
      } else if (eventType === 'error') {
        store._appendTextDelta(`\n\nError: ${data.error}`);
        store._finishStreaming();
      }
    }

    const messageBody: Record<string, unknown> = { content, uiContext };
    if (uploadedAssetIds && uploadedAssetIds.length > 0) {
      messageBody.uploadedAssetIds = uploadedAssetIds;
    }

    await fetchEventSource(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(messageBody),
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

  respondToPermission: async (
    chatId: string,
    promptId: string,
    decision: 'approve_once' | 'approve_session' | 'deny',
  ) => {
    const res = await fetch(`/api/chats/${chatId}/permission-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptId, decision }),
    });
    if (res.ok) {
      // Optimistically remove from pendingPermissions
      set((s) => {
        const existing = s.pendingPermissions[chatId] ?? [];
        return {
          pendingPermissions: {
            ...s.pendingPermissions,
            [chatId]: existing.filter((p) => p.promptId !== promptId),
          },
        };
      });
    }
  },

  dismissBudgetWarning: (chatId: string) => {
    set((s) => {
      const updated = { ...s.budgetWarnings };
      delete updated[chatId];
      return { budgetWarnings: updated };
    });
  },

  fetchUsageRollup: async (chatId: string) => {
    try {
      const res = await fetch(`/api/chats/${chatId}/usage-rollup`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        total_usd: number;
        images_generated: number;
        turns: number;
      };
      const rollup: UsageRollup = {
        totalUsd: data.total_usd,
        imagesGenerated: data.images_generated,
        turns: data.turns,
      };
      set((s) => ({ usageRollups: { ...s.usageRollups, [chatId]: rollup } }));
    } catch {
      // Non-fatal — rollup is best-effort
    }
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
