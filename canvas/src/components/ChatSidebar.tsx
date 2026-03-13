import type { ReactNode } from 'react';
import { useCampaignStore } from '../store/campaign';

interface ChatSidebarProps {
  children: ReactNode;
}

export function ChatSidebar({ children }: ChatSidebarProps) {
  const chatSidebarOpen = useCampaignStore((s) => s.chatSidebarOpen);

  return (
    <div style={{
      width: chatSidebarOpen ? 280 : 0,
      flexShrink: 0,
      overflow: 'hidden',
      transition: 'width 0.2s ease',
      borderRight: chatSidebarOpen ? '1px solid #1e1e1e' : 'none',
      backgroundColor: '#111111',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {children}
    </div>
  );
}
