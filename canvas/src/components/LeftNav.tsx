import type { ReactElement } from 'react';
import { useCampaignStore, type NavTab } from '../store/campaign';

interface NavItem {
  tab: NavTab;
  label: string;
  icon: () => ReactElement;
}

function CreateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TemplatesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="9" x2="9" y2="21" />
    </svg>
  );
}

function PatternsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5.64 5.64l2.83 2.83M15.53 15.53l2.83 2.83M5.64 18.36l2.83-2.83M15.53 8.47l2.83-2.83" />
    </svg>
  );
}

function VoiceGuideIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { tab: 'create', label: 'Create', icon: CreateIcon },
  { tab: 'templates', label: 'Templates', icon: TemplatesIcon },
  { tab: 'patterns', label: 'Patterns', icon: PatternsIcon },
  { tab: 'voice-guide', label: 'Voice Guide', icon: VoiceGuideIcon },
];

export function LeftNav() {
  const activeNavTab = useCampaignStore((s) => s.activeNavTab);
  const chatSidebarOpen = useCampaignStore((s) => s.chatSidebarOpen);
  const setActiveNavTab = useCampaignStore((s) => s.setActiveNavTab);
  const toggleChatSidebar = useCampaignStore((s) => s.toggleChatSidebar);

  return (
    <div style={{
      width: 52,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '0.5rem',
      paddingBottom: '0.75rem',
      backgroundColor: '#111111',
      borderRight: '1px solid #1e1e1e',
      height: '100%',
    }}>
      {/* Nav tabs at top */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', alignItems: 'center' }}>
        {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
          const isActive = activeNavTab === tab;
          return (
            <button
              key={tab}
              title={label}
              onClick={() => setActiveNavTab(tab)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                background: isActive ? '#1a1a1e' : 'none',
                border: 'none',
                borderLeft: isActive ? '2px solid #44B2FF' : '2px solid transparent',
                borderRadius: isActive ? '0 4px 4px 0' : 4,
                color: isActive ? '#e0e0e0' : '#666',
                cursor: 'pointer',
                transition: 'color 0.15s, background-color 0.15s',
                marginLeft: 2,
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = '#aaa';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = '#666';
              }}
            >
              <Icon />
            </button>
          );
        })}
      </div>

      {/* Chat toggle at bottom */}
      <div style={{ marginTop: 'auto' }}>
        <button
          title="AI Chat"
          onClick={toggleChatSidebar}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            background: 'none',
            border: 'none',
            borderRadius: 4,
            color: chatSidebarOpen ? '#44B2FF' : '#666',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!chatSidebarOpen) e.currentTarget.style.color = '#aaa';
          }}
          onMouseLeave={(e) => {
            if (!chatSidebarOpen) e.currentTarget.style.color = '#666';
          }}
        >
          <ChatBubbleIcon />
        </button>
      </div>
    </div>
  );
}
