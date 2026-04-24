import { useRef, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useCampaignStore } from '../store/campaign';
import { useChatStore } from '../store/chat';
import { ChatMessage } from './ChatMessage';
import { ChatHistory } from './ChatHistory';
import { PermissionPrompt } from './PermissionPrompt';
import './ChatSidebar.css';

/** Tool name → short human label + emoji for the active-tool chip */
function toolChipLabel(tool: string): string {
  const labels: Record<string, string> = {
    search_brand_images: 'Searching brand images...',
    generate_image: 'Generating image...',
    promote_generated_image: 'Promoting image...',
    read_skill: 'Reading skill...',
    save_creation: 'Saving creation...',
    edit_creation: 'Editing creation...',
    read_archetype: 'Reading archetype...',
    list_archetypes: 'Listing archetypes...',
  };
  return labels[tool] ?? `${tool.replace(/_/g, ' ')}...`;
}

export function ChatSidebar() {
  const chatSidebarOpen = useCampaignStore((s) => s.chatSidebarOpen);
  const currentView = useCampaignStore((s) => s.currentView);
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId);
  const activeCreationId = useCampaignStore((s) => s.activeCreationId);
  const activeIterationId = useCampaignStore((s) => s.activeIterationId);

  const {
    messages,
    activeChatId,
    isStreaming,
    sendMessage,
    cancelGeneration,
    loadChats,
    activeTools,
    pendingPermissions,
    budgetWarnings,
    usageRollups,
    respondToPermission,
    dismissBudgetWarning,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{
    id: string;
    url: string;
    name: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load chat list once on mount so the header + history panel don't start empty.
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    // Guard: jsdom doesn't implement scrollIntoView
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    // Always include every field (even as null) so the agent's system prompt
    // renders a consistent "Active campaign: none" instead of silently omitting
    // the line when nothing is selected. Keeps the model from guessing whether
    // the field is "undefined" vs "intentionally unset".
    sendMessage(
      input.trim(),
      {
        currentView: currentView ?? null,
        activeCampaignId: activeCampaignId ?? null,
        activeCreationId: activeCreationId ?? null,
        activeIterationId: activeIterationId ?? null,
      },
      pendingUpload ? [pendingUpload.id] : undefined,
    );
    setInput('');
    setPendingUpload(null);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset the input so the same file can be re-selected if removed
    e.target.value = '';

    setUploading(true);
    try {
      const res = await fetch('/api/uploads/chat-image', {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
          'x-filename': file.name,
        },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const data = (await res.json()) as { id: string; url: string; name: string };
      setPendingUpload({ id: data.id, url: data.url, name: data.name });
    } catch (err) {
      console.error('[ChatSidebar] Image upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const currentActiveTools = activeChatId ? (activeTools[activeChatId] ?? []) : [];
  const currentPermissions = activeChatId ? (pendingPermissions[activeChatId] ?? []) : [];
  const currentBudgetWarning = activeChatId ? budgetWarnings[activeChatId] : undefined;
  const currentRollup = activeChatId ? usageRollups[activeChatId] : undefined;

  return (
    <div
      style={{
        width: chatSidebarOpen ? 280 : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.2s ease',
        borderRight: chatSidebarOpen ? '1px solid #1e1e1e' : 'none',
        backgroundColor: '#111111',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <button
            className="chat-history-toggle"
            onClick={() => setShowHistory(!showHistory)}
            title="Chat history"
          >
            &#9776;
          </button>
          <span className="chat-sidebar-title">{activeChatId ? 'Chat' : 'New Chat'}</span>
          {isStreaming && (
            <button className="chat-cancel-btn" onClick={cancelGeneration}>
              Stop
            </button>
          )}
        </div>

        {showHistory && (
          <div className="chat-history-panel">
            <ChatHistory />
          </div>
        )}

        {/* Budget warning banner */}
        {currentBudgetWarning && (
          <div className="chat-budget-warning">
            <span className="chat-budget-warning-text">
              Daily image budget: ${currentBudgetWarning.remainingUsd.toFixed(2)} / $
              {currentBudgetWarning.capUsd.toFixed(2)} remaining
            </span>
            {activeChatId && (
              <button
                className="chat-budget-warning-dismiss"
                onClick={() => dismissBudgetWarning(activeChatId)}
                title="Dismiss"
              >
                &times;
              </button>
            )}
          </div>
        )}

        <div className="chat-messages-container">
          {messages.length === 0 && (
            <div className="chat-empty-state">
              <p>Ask me anything about your brand, or tell me what to create.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <ChatMessage key={msg.id ?? i} message={msg} />
          ))}

          {/* Permission prompts rendered below messages */}
          {currentPermissions.map((perm) => (
            <PermissionPrompt
              key={perm.promptId}
              prompt={perm}
              onDecide={(decision) => {
                if (activeChatId) {
                  respondToPermission(activeChatId, perm.promptId, decision);
                }
              }}
            />
          ))}

          {/* Active tool indicator */}
          {currentActiveTools.length > 0 && (
            <div className="chat-active-tools">
              {currentActiveTools.map((tool) => (
                <div key={tool.key} className="chat-active-tool-chip">
                  <span className="chat-active-tool-spinner" aria-hidden="true" />
                  {toolChipLabel(tool.tool)}
                  {tool.progressPct !== undefined && (
                    <span className="chat-active-tool-pct">{tool.progressPct}%</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Upload preview chip */}
        {pendingUpload && (
          <div className="chat-upload-preview">
            <img
              className="chat-upload-thumb"
              src={pendingUpload.url}
              alt={pendingUpload.name}
            />
            <span className="chat-upload-name">{pendingUpload.name}</span>
            <button
              className="chat-upload-remove"
              onClick={() => setPendingUpload(null)}
              title="Remove attachment"
            >
              &times;
            </button>
          </div>
        )}

        <form className="chat-input-form" onSubmit={handleSubmit}>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Attach button */}
          <button
            type="button"
            className="chat-attach-btn"
            onClick={handleAttachClick}
            disabled={isStreaming || uploading}
            title="Attach image"
          >
            {uploading ? (
              <span className="chat-attach-spinner" aria-label="Uploading..." />
            ) : (
              /* Paperclip SVG */
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            )}
          </button>

          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your creative partner..."
            rows={2}
            disabled={isStreaming}
          />
          <button className="chat-send-btn" type="submit" disabled={!input.trim() || isStreaming}>
            Send
          </button>
        </form>

        {/* Usage rollup footer */}
        {currentRollup && (
          <div className="chat-usage-footer">
            This session: ${currentRollup.totalUsd.toFixed(2)}
            {currentRollup.imagesGenerated > 0 && (
              <> &middot; {currentRollup.imagesGenerated} image{currentRollup.imagesGenerated !== 1 ? 's' : ''}</>
            )}
            {currentRollup.turns > 0 && (
              <> &middot; {currentRollup.turns} turn{currentRollup.turns !== 1 ? 's' : ''}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
