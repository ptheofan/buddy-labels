import { Check, Database, Search } from 'lucide-react';
import type { InventorySource, InventorySpool } from '../types';
import { colorStops, swatchBackground } from '../lib/colors';

interface InventorySidebarProps {
  spools: InventorySpool[];
  selectedId: number | null;
  source: InventorySource;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (spool: InventorySpool) => void;
  onSourceChange: (source: InventorySource) => void;
  usingSampleData: boolean;
}

function spoolLabel(spool: InventorySpool): string {
  return [spool.material, spool.subtype].filter(Boolean).join(' ') || 'Filament';
}

export function InventorySidebar({
  spools,
  selectedId,
  source,
  query,
  onQueryChange,
  onSelect,
  onSourceChange,
  usingSampleData,
}: InventorySidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="section-title">
          <Database size={17} />
          <span>Inventory</span>
        </div>
        <select value={source} onChange={(event) => onSourceChange(event.target.value as InventorySource)}>
          <option value="local">Local inventory</option>
          <option value="spoolman">Spoolman</option>
        </select>
      </div>

      <label className="search-box">
        <Search size={15} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search spools"
        />
      </label>

      {usingSampleData && <div className="sample-note">Showing sample spools until Bambuddy is configured.</div>}

      <div className="spool-list">
        {spools.map((spool) => {
          const colors = colorStops(spool.rgba, spool.extra_colors);
          const selected = spool.id === selectedId;
          return (
            <button
              key={spool.id}
              className={`spool-row ${selected ? 'selected' : ''}`}
              type="button"
              onClick={() => onSelect(spool)}
            >
              <span className="spool-swatch" style={{ background: swatchBackground(colors) }} />
              <span className="spool-main">
                <span>{spool.color_name || spoolLabel(spool)}</span>
                <small>{[spool.brand, spoolLabel(spool)].filter(Boolean).join(' / ')}</small>
              </span>
              <span className="spool-id">#{spool.id}</span>
              {selected && <Check className="selected-icon" size={16} />}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
