import { CURRENT_APP_VERSION, resolveVersionRepository } from './version';
import type { BambuddyApiConnection, BambuddyConfig, BambuddyDirectConnection, InventorySource, InventorySpool } from '../types';

export const proxyConnection: BambuddyApiConnection = { mode: 'proxy' };

export function normalizeBambuddyBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function directHeaders(connection: BambuddyDirectConnection): HeadersInit {
  return {
    Accept: 'application/json',
    'X-API-Key': connection.apiKey,
    Authorization: `Bearer ${connection.apiKey}`,
  };
}

function directUrl(connection: BambuddyDirectConnection, path: string): string {
  return `${normalizeBambuddyBaseUrl(connection.baseUrl)}/api/v1${path}`;
}

async function parseError(response: Response): Promise<string> {
  const body = await response.text().catch(() => '');
  if (!body) return `HTTP ${response.status}`;
  try {
    const parsed = JSON.parse(body) as { error?: unknown; detail?: unknown; message?: unknown };
    const message = parsed.error || parsed.detail || parsed.message;
    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // Plain text error bodies are useful as-is.
  }
  return body;
}

function directFetchErrorMessage(): string {
  return 'Browser could not reach Bambuddy directly. Check the URL, HTTPS/CORS settings, and network access.';
}

async function requestDirectJson<T>(connection: BambuddyDirectConnection, path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(directUrl(connection, path), {
      headers: directHeaders(connection),
    });
  } catch {
    throw new Error(directFetchErrorMessage());
  }

  if (!response.ok) {
    const body = await parseError(response);
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Bambuddy rejected the API key or permissions: ${body}`);
    }
    throw new Error(body || `Bambuddy returned HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function inventoryPath(source: InventorySource): string {
  return source === 'spoolman' ? '/spoolman/inventory/spools' : '/inventory/spools';
}

async function fetchProxyConfig(): Promise<BambuddyConfig> {
  const response = await fetch('/api/config');
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Buddy Labels proxy is not available; connect to Bambuddy directly or run the Docker container.');
    }
    throw new Error(`Config request failed: HTTP ${response.status}`);
  }
  const config = (await response.json()) as BambuddyConfig;
  return {
    ...config,
    mode: 'proxy',
  };
}

async function fetchDirectConfig(connection: BambuddyDirectConnection): Promise<BambuddyConfig> {
  const baseUrl = normalizeBambuddyBaseUrl(connection.baseUrl);
  let externalUrl = '';
  let settingsError = '';

  try {
    const settings = await requestDirectJson<{ external_url?: unknown }>(connection, '/settings/');
    externalUrl = typeof settings.external_url === 'string' ? normalizeBambuddyBaseUrl(settings.external_url) : '';
  } catch (err) {
    settingsError = err instanceof Error ? err.message : 'Could not read Bambuddy settings';
  }

  return {
    configured: Boolean(baseUrl && connection.apiKey.trim()),
    connected: !settingsError,
    baseUrl,
    externalUrl,
    qrBaseUrl: externalUrl || baseUrl,
    hasApiKey: Boolean(connection.apiKey.trim()),
    settingsError,
    appVersion: CURRENT_APP_VERSION,
    githubRepository: resolveVersionRepository(),
    mode: 'direct',
    savedInBrowser: connection.savedInBrowser,
  };
}

export async function fetchConfig(connection: BambuddyApiConnection = proxyConnection): Promise<BambuddyConfig> {
  if (connection.mode === 'direct') return fetchDirectConfig(connection);
  return fetchProxyConfig();
}

async function fetchProxySpools(source: InventorySource): Promise<InventorySpool[]> {
  const response = await fetch(`/api/spools?source=${source}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Inventory request failed: HTTP ${response.status}`);
  }
  const payload = await response.json();
  return payload.spools;
}

async function fetchDirectSpools(source: InventorySource, connection: BambuddyDirectConnection): Promise<InventorySpool[]> {
  return requestDirectJson<InventorySpool[]>(connection, inventoryPath(source));
}

export async function fetchSpools(
  source: InventorySource,
  connection: BambuddyApiConnection = proxyConnection,
): Promise<InventorySpool[]> {
  if (connection.mode === 'direct') return fetchDirectSpools(source, connection);
  return fetchProxySpools(source);
}
