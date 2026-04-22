import { useState, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ContextMapEntry {
  id: string;
  creation_type: string;
  stage: string;
  page: string;
  sections: string[];
  priority: number;
  max_tokens: number | null;
  sort_order: number;
  updated_at: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CREATION_TYPE_OPTIONS = ['instagram', 'linkedin', 'one-pager'];
const STAGE_OPTIONS = ['copy', 'layout', 'styling', 'spec-check'];
const PAGE_OPTIONS = ['voice-guide', 'patterns', 'templates', 'assets'];

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SettingsScreen
// ─────────────────────────────────────────────────────────────────────────────

export function SettingsScreen() {
  const [entries, setEntries] = useState<ContextMapEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load entries on mount
  useEffect(() => {
    fetch('/api/context-map')
      .then((r) => {
        if (!r.ok) throw new Error('load failed');
        return r.json();
      })
      .then((data: ContextMapEntry[]) => setEntries(data))
      .catch(() => setLoadError('Could not load context map. Check the server is running.'));
  }, []);

  // ── Edit helpers ──────────────────────────────────────────────────────────

  function startEdit(id: string, field: string, value: string) {
    setEditingId(id);
    setEditField(field);
    setEditValue(value);
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditField(null);
    setEditValue('');
  }

  async function saveEdit(id: string, field: string, value: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return cancelEdit();

    // Build updated entry
    const updated: Partial<ContextMapEntry> = {};
    if (field === 'creation_type') updated.creation_type = value;
    else if (field === 'stage') updated.stage = value;
    else if (field === 'page') updated.page = value;
    else if (field === 'sections')
      updated.sections = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    else if (field === 'priority')
      updated.priority = Math.min(100, Math.max(1, parseInt(value, 10) || entry.priority));
    else if (field === 'max_tokens')
      updated.max_tokens = value === '' ? null : parseInt(value, 10) || null;

    // Optimistic update
    const prevEntries = entries;
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...updated } : e)));
    cancelEdit();

    try {
      const res = await fetch(`/api/context-map/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, ...updated }),
      });
      if (!res.ok) throw new Error('save failed');

      // Flash saved confirmation
      setSavedId(id);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedId(null), 2000);
    } catch {
      // Revert on error
      setEntries(prevEntries);
      setSaveError('Save failed — changes were reverted. Try again.');
    }
  }

  function handleCellKeyDown(e: React.KeyboardEvent, id: string, field: string) {
    if (e.key === 'Escape') {
      cancelEdit();
    } else if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      saveEdit(id, field, editValue);
    }
  }

  // ── Add entry ─────────────────────────────────────────────────────────────

  function handleAddEntry() {
    const tempId = `new-${Date.now()}`;
    const newEntry: ContextMapEntry = {
      id: tempId,
      creation_type: 'instagram',
      stage: 'copy',
      page: 'patterns',
      sections: [],
      priority: 50,
      max_tokens: null,
      sort_order: entries.length,
      updated_at: Date.now(),
    };
    setEntries((es) => [...es, newEntry]);
    startEdit(tempId, 'sections', '');
  }

  async function saveNewEntry(tempId: string) {
    const entry = entries.find((e) => e.id === tempId);
    if (!entry) return cancelEdit();

    const sectionsValue = editField === 'sections' ? editValue : entry.sections.join(', ');
    const sections = sectionsValue
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    cancelEdit();

    try {
      const res = await fetch('/api/context-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_type: entry.creation_type,
          stage: entry.stage,
          page: entry.page,
          sections,
          priority: entry.priority,
          max_tokens: entry.max_tokens,
        }),
      });
      if (!res.ok) throw new Error('create failed');
      const created: ContextMapEntry = await res.json();
      // Replace temp entry with real one
      setEntries((es) => es.map((e) => (e.id === tempId ? created : e)));
      setSavedId(created.id);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedId(null), 2000);
    } catch {
      // Remove temp entry on failure
      setEntries((es) => es.filter((e) => e.id !== tempId));
      setSaveError('Save failed — changes were reverted. Try again.');
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDeleteConfirm(id: string) {
    const isTemp = id.startsWith('new-');
    setConfirmDeleteId(null);

    if (isTemp) {
      setEntries((es) => es.filter((e) => e.id !== id));
      return;
    }

    try {
      const res = await fetch(`/api/context-map/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setEntries((es) => es.filter((e) => e.id !== id));
    } catch {
      setSaveError('Save failed — changes were reverted. Try again.');
    }
  }

  // ── Cell rendering ────────────────────────────────────────────────────────

  function renderCell(entry: ContextMapEntry, field: string, displayValue: string) {
    const isEditing = editingId === entry.id && editField === field;
    const isSaved = savedId === entry.id;
    const isNew = entry.id.startsWith('new-');

    const cellStyle: React.CSSProperties = {
      padding: '8px',
      fontSize: '0.875rem',
      color: isSaved ? '#7be0a0' : '#e0e0e0',
      backgroundColor: isEditing ? '#1e2535' : '#1a1a1e',
      border: isEditing ? '1px solid #44B2FF' : '1px solid transparent',
      borderRadius: 4,
      cursor: 'text',
      minWidth: field === 'sections' ? 160 : undefined,
      transition: 'color 0.3s',
      whiteSpace: field === 'sections' ? 'normal' : 'nowrap',
      verticalAlign: 'top',
    };

    if (isEditing) {
      if (field === 'creation_type' || field === 'stage' || field === 'page') {
        const options =
          field === 'creation_type'
            ? CREATION_TYPE_OPTIONS
            : field === 'page'
              ? PAGE_OPTIONS
              : STAGE_OPTIONS;
        return (
          <td style={cellStyle}>
            <select
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => {
                if (isNew) saveNewEntry(entry.id);
                else saveEdit(entry.id, field, editValue);
              }}
              onKeyDown={(e) => handleCellKeyDown(e, entry.id, field)}
              style={{
                backgroundColor: '#1e2535',
                border: 'none',
                color: '#e0e0e0',
                fontSize: '0.875rem',
                outline: 'none',
                width: '100%',
                cursor: 'pointer',
              }}
            >
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </td>
        );
      }

      if (field === 'sections') {
        return (
          <td style={cellStyle}>
            <textarea
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => {
                if (isNew) saveNewEntry(entry.id);
                else saveEdit(entry.id, field, editValue);
              }}
              onKeyDown={(e) => handleCellKeyDown(e, entry.id, field)}
              placeholder="e.g. voice-guide:*, design-tokens:color-palette"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#e0e0e0',
                fontSize: '0.875rem',
                outline: 'none',
                width: '100%',
                minHeight: 48,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </td>
        );
      }

      // Number inputs (priority, max_tokens)
      return (
        <td style={cellStyle}>
          <input
            autoFocus
            type="number"
            value={editValue}
            min={field === 'priority' ? 1 : undefined}
            max={field === 'priority' ? 100 : undefined}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => {
              if (isNew) saveNewEntry(entry.id);
              else saveEdit(entry.id, field, editValue);
            }}
            onKeyDown={(e) => handleCellKeyDown(e, entry.id, field)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#e0e0e0',
              fontSize: '0.875rem',
              outline: 'none',
              width: 64,
              fontFamily: 'inherit',
            }}
          />
        </td>
      );
    }

    return (
      <td style={cellStyle} onClick={() => startEdit(entry.id, field, displayValue)}>
        {isSaved && editingId !== entry.id ? (
          <span style={{ color: '#7be0a0', fontSize: '0.72rem' }}>Saved</span>
        ) : (
          displayValue || <span style={{ color: '#555' }}>—</span>
        )}
      </td>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        backgroundColor: '#0d0d0d',
        color: '#e0e0e0',
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: '0 auto',
          paddingTop: 48,
          paddingLeft: 24,
          paddingRight: 24,
          paddingBottom: 48,
        }}
      >
        {/* Page heading */}
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: '0 0 6px' }}>
          Pipeline Settings
        </h1>
        <p style={{ fontSize: 14, color: '#888', margin: '0 0 40px' }}>
          Configure which brand context each pipeline stage receives.
        </p>

        {/* Context Map section */}
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>
            Context Map
          </h2>
          <p style={{ fontSize: '0.72rem', color: '#888', margin: '0 0 16px', lineHeight: 1.5 }}>
            Maps (creation type, stage) to brand sections. Wildcards like{' '}
            <code style={{ backgroundColor: '#1a1a1e', padding: '1px 4px', borderRadius: 3 }}>
              design-tokens:*
            </code>{' '}
            expand at runtime.
          </p>

          {/* Error states */}
          {loadError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#2b1a1a',
                border: '1px solid #5a2a2a',
                borderRadius: 5,
                color: '#e08080',
                fontSize: '0.875rem',
                marginBottom: 16,
              }}
            >
              {loadError}
            </div>
          )}
          {saveError && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#2b1a1a',
                border: '1px solid #5a2a2a',
                borderRadius: 5,
                color: '#e08080',
                fontSize: '0.875rem',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>{saveError}</span>
              <button
                onClick={() => setSaveError(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#e08080',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loadError && entries.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 24px',
                backgroundColor: '#1a1a1e',
                borderRadius: 6,
                border: '1px solid #1e1e1e',
              }}
            >
              <h3
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#e0e0e0',
                  margin: '0 0 8px',
                }}
              >
                No context map entries
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#555', margin: 0, lineHeight: 1.5 }}>
                Add entries to define what brand context each stage receives. Without a map, agents
                self-discover context using DB tools.
              </p>
            </div>
          )}

          {/* Table */}
          {entries.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'separate',
                  borderSpacing: '0 2px',
                  tableLayout: 'auto',
                }}
              >
                <thead>
                  <tr>
                    {[
                      'Creation Type',
                      'Stage',
                      'Page',
                      'Sections',
                      'Priority',
                      'Token Budget',
                      '',
                    ].map((header) => (
                      <th
                        key={header}
                        style={{
                          padding: '6px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: '#888',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          textAlign: 'left',
                          borderBottom: '1px solid #1e1e1e',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <>
                      <tr
                        key={entry.id}
                        onMouseEnter={() => setHoveredRowId(entry.id)}
                        onMouseLeave={() => setHoveredRowId(null)}
                        style={{ position: 'relative' }}
                      >
                        {renderCell(entry, 'creation_type', entry.creation_type)}
                        {renderCell(entry, 'stage', entry.stage)}
                        {renderCell(entry, 'page', entry.page)}
                        {renderCell(entry, 'sections', entry.sections.join(', '))}
                        {renderCell(entry, 'priority', String(entry.priority))}
                        {renderCell(
                          entry,
                          'max_tokens',
                          entry.max_tokens != null ? String(entry.max_tokens) : '',
                        )}
                        {/* Delete button cell */}
                        <td
                          style={{
                            padding: '8px 4px',
                            verticalAlign: 'top',
                            backgroundColor: '#1a1a1e',
                            width: 28,
                          }}
                        >
                          <button
                            aria-label="Delete entry"
                            onClick={() => setConfirmDeleteId(entry.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#e08080',
                              cursor: 'pointer',
                              padding: 2,
                              opacity: hoveredRowId === entry.id ? 1 : 0,
                              transition: 'opacity 0.15s',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <TrashIcon />
                          </button>
                        </td>
                      </tr>
                      {/* Inline delete confirm strip */}
                      {confirmDeleteId === entry.id && (
                        <tr key={`${entry.id}-confirm`}>
                          <td
                            colSpan={7}
                            style={{
                              padding: '8px 12px',
                              backgroundColor: '#3e2a2a',
                              borderLeft: '3px solid #e08080',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                fontSize: '0.875rem',
                              }}
                            >
                              <span style={{ color: '#e08080', flex: 1 }}>
                                Remove this entry? This stage will fall back to agent
                                self-discovery.
                              </span>
                              <button
                                onClick={() => handleDeleteConfirm(entry.id)}
                                style={{
                                  background: 'none',
                                  border: '1px solid #e08080',
                                  color: '#e08080',
                                  borderRadius: 4,
                                  padding: '3px 10px',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                }}
                              >
                                Remove entry
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                style={{
                                  background: 'none',
                                  border: '1px solid #3a3a3e',
                                  color: '#888',
                                  borderRadius: 4,
                                  padding: '3px 10px',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                }}
                              >
                                Keep entry
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add entry button */}
          {!loadError && (
            <button
              onClick={handleAddEntry}
              style={{
                marginTop: 12,
                background: 'none',
                border: '1px dashed #2a2a2e',
                borderRadius: 5,
                color: '#666',
                fontSize: '0.8rem',
                padding: '6px 14px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#aaa';
                e.currentTarget.style.borderColor = '#44B2FF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#666';
                e.currentTarget.style.borderColor = '#2a2a2e';
              }}
            >
              + Add entry
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
