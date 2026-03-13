import { useSessionStore } from '../store/sessions';

export function SessionSidebar() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const selectSession = useSessionStore((s) => s.selectSession);

  return (
    <aside style={{
      width: 280,
      minWidth: 280,
      height: '100vh',
      backgroundColor: '#12121a',
      borderRight: '1px solid #2a2a2e',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #2a2a2e',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '0.85rem',
          fontWeight: 600,
          color: '#888',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Sessions
        </h2>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.5rem',
      }}>
        {sessions.length === 0 && (
          <div style={{
            padding: '1.5rem 1rem',
            color: '#555',
            fontSize: '0.85rem',
            textAlign: 'center',
          }}>
            No sessions found.
            <br />
            <span style={{ fontSize: '0.75rem', color: '#444' }}>
              Generate assets to see them here.
            </span>
          </div>
        )}

        {sessions.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <button
              key={session.id}
              onClick={() => selectSession(session.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.75rem',
                marginBottom: '0.25rem',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: isActive ? '#2a2a2e' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = '#1e1e1e';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{
                fontSize: '0.85rem',
                fontWeight: 500,
                color: isActive ? '#fff' : '#ccc',
                fontFamily: 'monospace',
              }}>
                {formatSessionId(session.id)}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.35rem',
              }}>
                <PlatformBadge platform={session.platform} />
                <span style={{ fontSize: '0.7rem', color: '#666' }}>
                  {session.versionCount} version{session.versionCount !== 1 ? 's' : ''}
                </span>
                {session.hasAnnotations && (
                  <span style={{ fontSize: '0.7rem', color: '#eab308' }} title="Has annotations">
                    *
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 6px',
      borderRadius: '4px',
      fontSize: '0.65rem',
      fontWeight: 600,
      backgroundColor: '#333',
      color: '#aaa',
      textTransform: 'uppercase',
    }}>
      {platform}
    </span>
  );
}

/**
 * Format session ID (YYYYMMDD-HHMMSS) into readable date/time.
 */
function formatSessionId(id: string): string {
  const match = id.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!match) return id;
  const [, y, m, d, h, min] = match;
  return `${y}-${m}-${d} ${h}:${min}`;
}
