import React from 'react';
import { useChatStore } from '../store/chat';

export function ChatHistory() {
  const { chats, activeChatId, openChat, createChat, deleteChat, loadChats } = useChatStore();

  React.useEffect(() => { loadChats(); }, []);

  return (
    <div className="chat-history">
      <button className="chat-new-btn" onClick={() => createChat()}>
        + New Chat
      </button>
      <div className="chat-history-list">
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`chat-history-item ${chat.id === activeChatId ? 'active' : ''}`}
            onClick={() => openChat(chat.id)}
          >
            <span className="chat-history-title">
              {chat.title ?? 'New chat'}
            </span>
            <button
              className="chat-history-delete"
              onClick={e => { e.stopPropagation(); deleteChat(chat.id); }}
              title="Delete chat"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
