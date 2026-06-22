import type { BambuddyDirectConnection } from '../types';
import { normalizeBambuddyBaseUrl } from './api';

const storageKey = 'buddy-labels.bambuddyConnection.v1';

interface StoredConnection {
  version: 1;
  baseUrl: string;
  apiKey: string;
  savedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createDirectConnection(baseUrl: string, apiKey: string, savedInBrowser: boolean): BambuddyDirectConnection {
  return {
    mode: 'direct',
    baseUrl: normalizeBambuddyBaseUrl(baseUrl),
    apiKey: apiKey.trim(),
    savedInBrowser,
  };
}

export function loadStoredBambuddyConnection(): BambuddyDirectConnection | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) return null;
    const baseUrl = typeof parsed.baseUrl === 'string' ? normalizeBambuddyBaseUrl(parsed.baseUrl) : '';
    const apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '';
    if (!baseUrl || !apiKey) return null;
    return createDirectConnection(baseUrl, apiKey, true);
  } catch {
    return null;
  }
}

export function saveStoredBambuddyConnection(connection: BambuddyDirectConnection): void {
  const stored: StoredConnection = {
    version: 1,
    baseUrl: normalizeBambuddyBaseUrl(connection.baseUrl),
    apiKey: connection.apiKey,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(storageKey, JSON.stringify(stored));
}

export function forgetStoredBambuddyConnection(): void {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // The in-memory connection can still be cleared even when storage is blocked.
  }
}
