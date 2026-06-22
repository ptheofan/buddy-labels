import { AlertCircle, KeyRound, Lock, PlugZap, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BambuddyConfig, BambuddyDirectConnection } from '../types';
import { normalizeBambuddyBaseUrl } from '../lib/api';

export interface BambuddyConnectionDraft {
  baseUrl: string;
  apiKey: string;
  saveInBrowser: boolean;
}

interface BambuddyConnectionDialogProps {
  open: boolean;
  currentConnection: BambuddyDirectConnection | null;
  config: BambuddyConfig | null;
  busy: boolean;
  status: string;
  onClose: () => void;
  onConnect: (draft: BambuddyConnectionDraft) => void;
  onDisconnect: () => void;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function BambuddyConnectionDialog({
  open,
  currentConnection,
  config,
  busy,
  status,
  onClose,
  onConnect,
  onDisconnect,
}: BambuddyConnectionDialogProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saveInBrowser, setSaveInBrowser] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!open) return;
    setBaseUrl(currentConnection?.baseUrl || '');
    setApiKey(currentConnection?.apiKey || '');
    setSaveInBrowser(Boolean(currentConnection?.savedInBrowser));
    setValidationError('');
  }, [currentConnection, open]);

  if (!open) return null;

  const normalizedBaseUrl = normalizeBambuddyBaseUrl(baseUrl);
  const canDisconnect = Boolean(currentConnection);

  const submit = () => {
    const trimmedApiKey = apiKey.trim();
    if (!normalizedBaseUrl) {
      setValidationError('Bambuddy URL is required.');
      return;
    }
    if (!isValidHttpUrl(normalizedBaseUrl)) {
      setValidationError('Use a full http:// or https:// Bambuddy URL.');
      return;
    }
    if (!trimmedApiKey) {
      setValidationError('API key is required for direct browser mode.');
      return;
    }
    setValidationError('');
    onConnect({
      baseUrl: normalizedBaseUrl,
      apiKey: trimmedApiKey,
      saveInBrowser,
    });
  };

  const modeLabel =
    currentConnection?.savedInBrowser
      ? 'Direct browser mode, saved locally'
      : currentConnection
        ? 'Direct browser mode, memory only'
        : config?.mode === 'proxy' && config.configured
          ? 'Docker proxy mode is available'
          : 'No Bambuddy connection configured';

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="connection-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="connection-dialog-header">
          <div>
            <p className="dialog-eyebrow">Bambuddy connection</p>
            <h2 id="connection-dialog-title">Connect this browser to Bambuddy</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close Bambuddy connection dialog">
            <X size={16} />
          </button>
        </header>

        <div className="connection-mode-card">
          <PlugZap size={17} />
          <div>
            <strong>{modeLabel}</strong>
            <span>
              Browser mode calls Bambuddy directly from this page. Bambuddy must allow CORS from this site, and HTTPS
              pages cannot call an HTTP-only Bambuddy URL.
            </span>
          </div>
        </div>

        <div className="connection-form">
          <label>
            Bambuddy URL
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://buddy.example.com"
              autoComplete="url"
            />
          </label>
          <label>
            API key/token
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="bb_..."
              autoComplete="off"
            />
          </label>
          <label className="inline-check connection-save-check">
            <input
              type="checkbox"
              checked={saveInBrowser}
              onChange={(event) => setSaveInBrowser(event.target.checked)}
            />
            Save in browser
          </label>
        </div>

        <div className="security-note">
          <Lock size={16} />
          <span>
            Saving is convenient but insecure: the API key is stored in this browser's localStorage and can be read by
            scripts running on this site or by anyone using this browser profile.
          </span>
        </div>

        {(validationError || status) && (
          <div className={`connection-message ${validationError ? 'error' : ''}`} role="status" aria-live="polite">
            <AlertCircle size={16} />
            <span>{validationError || status}</span>
          </div>
        )}

        <footer className="connection-dialog-actions">
          {canDisconnect && (
            <button className="danger-action" type="button" onClick={onDisconnect} disabled={busy}>
              <Trash2 size={15} />
              Forget
            </button>
          )}
          <button className="secondary-action" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary-action" type="button" onClick={submit} disabled={busy}>
            <KeyRound size={16} />
            {busy ? 'Connecting...' : 'Connect'}
          </button>
        </footer>
      </section>
    </div>
  );
}
