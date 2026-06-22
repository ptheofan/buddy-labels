import type { BambuddyConfig, InventorySource, InventorySpool } from '../types';

export async function fetchConfig(): Promise<BambuddyConfig> {
  const response = await fetch('/api/config');
  if (!response.ok) {
    throw new Error(`Config request failed: HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchSpools(source: InventorySource): Promise<InventorySpool[]> {
  const response = await fetch(`/api/spools?source=${source}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Inventory request failed: HTTP ${response.status}`);
  }
  const payload = await response.json();
  return payload.spools;
}
