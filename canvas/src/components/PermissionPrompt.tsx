import type { PendingPermission } from '../store/chat';
import './PermissionPrompt.css';

interface PermissionPromptProps {
  prompt: PendingPermission;
  onDecide: (decision: 'approve_once' | 'approve_session' | 'deny') => void;
}

/** Format a snake_case tool name into a human-readable label. */
function humanizeTool(tool: string): string {
  return tool
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PermissionPrompt({ prompt, onDecide }: PermissionPromptProps) {
  return (
    <div className="permission-prompt">
      <div className="permission-prompt-title">
        {/* Inline SVG: lock icon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginRight: 6, verticalAlign: 'middle' }}
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Permission required: {humanizeTool(prompt.tool)}
      </div>

      {prompt.reason && (
        <div className="permission-prompt-reason">{prompt.reason}</div>
      )}

      {prompt.argsPreview && (
        <pre className="permission-prompt-args">{prompt.argsPreview}</pre>
      )}

      {prompt.estCostUsd !== undefined && prompt.estCostUsd > 0 && (
        <div className="permission-prompt-cost">
          Estimated cost: ${prompt.estCostUsd.toFixed(4)}
        </div>
      )}

      <div className="permission-prompt-actions">
        <button
          className="permission-prompt-btn permission-prompt-btn--deny"
          onClick={() => onDecide('deny')}
        >
          Deny
        </button>
        <button
          className="permission-prompt-btn permission-prompt-btn--once"
          onClick={() => onDecide('approve_once')}
        >
          Approve once
        </button>
        <button
          className="permission-prompt-btn permission-prompt-btn--session"
          onClick={() => onDecide('approve_session')}
        >
          Approve for this session
        </button>
      </div>
    </div>
  );
}
