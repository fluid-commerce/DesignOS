import { useRef, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useCampaignStore } from '../store/campaign';
import { useChatStore } from '../store/chat';
import { ChatMessage } from './ChatMessage';
import { ChatHistory } from './ChatHistory';
import './ChatSidebar.css';

export function ChatSidebar() {
  const chatSidebarOpen = useCampaignStore((s) => s.chatSidebarOpen);
  const currentView = useCampaignStore((s) => s.currentView);
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId);
  const activeCreationId = useCampaignStore((s) => s.activeCreationId);
  const activeIterationId = useCampaignStore((s) => s.activeIterationId);

  const { messages, activeChatId, isStreaming, sendMessage, cancelGeneration, loadChats } =
    useChatStore();

  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    sendMessage(input.trim(), {
      currentView,
      activeCampaignId,
      activeCreationId,
      activeIterationId,
    });
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

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

        <div className="chat-messages-container">
          {messages.length === 0 && (
            <div className="chat-empty-state">
              <p>Ask me anything about your brand, or tell me what to create.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <ChatMessage key={msg.id ?? i} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-form" onSubmit={handleSubmit}>
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
      </div>
    </div>
  );
}
