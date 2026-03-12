/**
 * ExportActions — JPG, WebP, and HTML export buttons.
 *
 * JPG/WebP: sends postMessage({ type: 'capture', id, fmt, scale, h2c }) to
 * iframe, waits for { type: 'captured', id, dataUrl } response, triggers download.
 *
 * HTML: fetches the raw HTML from the iteration's htmlPath and triggers download.
 * For carousel/multi-asset exports, uses JSZip if available (graceful fallback to
 * single-file download).
 *
 * The iframe must have html2canvas available (Jonathan's templates include it; for
 * AI-generated assets, the capture handler injects it from h2c URL on demand).
 */

import { useState, useEffect, useRef } from 'react';
import type { Iteration } from '../lib/campaign-types';

interface ExportActionsProps {
  iteration: Iteration;
  iframeEl: HTMLIFrameElement | null;
}

type ExportFormat = 'jpeg' | 'webp' | 'html';

/** Pending capture callbacks keyed by capture ID */
const pendingCaptures: Record<string, (data: { dataUrl?: string; error?: string }) => void> = {};

/** Install a global message listener for capture results (idempotent) */
let captureListenerInstalled = false;
function ensureCaptureListener() {
  if (captureListenerInstalled) return;
  captureListenerInstalled = true;
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || d.type !== 'captured') return;
    const cb = pendingCaptures[d.id];
    if (cb) {
      delete pendingCaptures[d.id];
      cb({ dataUrl: d.dataUrl, error: d.error });
    }
  });
}

/** Trigger a browser file download from a data URL or Blob URL */
function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function ExportActions({ iteration, iframeEl }: ExportActionsProps) {
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const h2cUrl = useRef(`${window.location.origin}/html2canvas.min.js`);

  useEffect(() => {
    ensureCaptureListener();
  }, []);

  const exportImage = async (fmt: 'jpeg' | 'webp') => {
    if (!iframeEl?.contentWindow) {
      setError('Preview not available');
      return;
    }
    setLoading(fmt);
    setError(null);

    const id = `cap_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
      const result = await new Promise<{ dataUrl?: string; error?: string }>((resolve) => {
        pendingCaptures[id] = resolve;
        // Timeout after 30 seconds
        setTimeout(() => {
          delete pendingCaptures[id];
          resolve({ error: 'Capture timed out' });
        }, 30_000);

        iframeEl.contentWindow!.postMessage(
          { type: 'capture', id, fmt, scale: 1, h2c: h2cUrl.current },
          '*'
        );
      });

      if (result.error) {
        setError(`Export failed: ${result.error}`);
      } else if (result.dataUrl) {
        const ext = fmt === 'webp' ? 'webp' : 'jpg';
        const filename = `fluid-asset-${iteration.id}.${ext}`;
        triggerDownload(result.dataUrl, filename);
      }
    } finally {
      setLoading(null);
    }
  };

  const exportHtml = async () => {
    setLoading('html');
    setError(null);

    try {
      // Fetch HTML with assets inlined so the file works when opened locally
      const res = await fetch(`/api/iterations/${iteration.id}/html?download=1`);
      if (!res.ok) {
        setError(`Could not fetch HTML (${res.status})`);
        return;
      }
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const filename = `fluid-asset-${iteration.id}.html`;
      triggerDownload(url, filename);
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch (err) {
      setError(`Export failed: ${String(err)}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.buttonRow}>
        <ExportButton
          label="JPG"
          isLoading={loading === 'jpeg'}
          onClick={() => exportImage('jpeg')}
        />
        <ExportButton
          label="WebP"
          isLoading={loading === 'webp'}
          onClick={() => exportImage('webp')}
        />
        <ExportButton
          label="HTML"
          isLoading={loading === 'html'}
          onClick={exportHtml}
        />
      </div>
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

function ExportButton({
  label,
  isLoading,
  onClick,
}: {
  label: string;
  isLoading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      style={{
        ...styles.btn,
        ...(isLoading ? styles.btnLoading : {}),
      }}
      onClick={onClick}
      disabled={isLoading}
    >
      {isLoading ? '...' : `Download ${label}`}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  buttonRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  btn: {
    width: '100%',
    backgroundColor: 'transparent',
    border: '1px solid #2a2a2e',
    borderRadius: 4,
    color: '#e0e0e0',
    padding: '7px 12px',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'center',
    transition: 'border-color 0.12s, color 0.12s',
  },
  btnLoading: {
    opacity: 0.6,
    cursor: 'default',
  },
  error: {
    fontSize: '0.7rem',
    color: '#f87171',
    marginTop: 4,
  },
};
